# ================================================================================
# COELIACS LIKE BEER TOO - UPDATED APP.PY FOR OSM SCHEMA
# ================================================================================

from flask import Flask, request, jsonify, render_template, redirect
import mysql.connector
import os
from dotenv import load_dotenv
import logging
import time
import json
from datetime import datetime, timedelta
import requests
import math
import random
import hashlib
import secrets
import string

# Initialize Flask app
app = Flask(__name__, 
            static_folder='static',
            static_url_path='/static')

# Load environment variables
load_dotenv()

# Database configuration
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "ssl_disabled": os.getenv("DB_SSL_DISABLED", "false").lower() == "true"
}

# Set up logging
logging.basicConfig(level=logging.INFO if os.getenv("FLASK_ENV") == "production" else logging.DEBUG)
logger = logging.getLogger(__name__)

# Security headers
@app.after_request
def security_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache" 
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

from functools import wraps

# Simple admin authentication
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_token = request.headers.get('Authorization') or request.args.get('token')
        expected_token = os.getenv('ADMIN_TOKEN', 'beer_admin_2025')
        
        if not auth_token or auth_token != expected_token:
            return jsonify({'error': 'Admin authentication required'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

# ==================================================
# ONBOARDING & USER SESSIONS
# ==================================================


def generate_passcode():
    """Generate a memorable 6-character passcode"""
    # Use a mix of letters and numbers for memorability
    chars = string.ascii_uppercase + string.digits
    # Avoid confusing characters
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    return ''.join(secrets.choice(chars) for _ in range(6))

def hash_passcode(passcode):
    """Hash passcode for secure storage"""
    return hashlib.sha256(passcode.encode()).hexdigest()

@app.route('/api/user/create', methods=['POST'])
def create_user():
    # Check if request has JSON data
    if not request.is_json:
        logger.error(f"Request is not JSON. Content-Type: {request.content_type}")
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    
    # Check if data is None or empty
    if not data:
        logger.error(f"Empty request body. Headers: {dict(request.headers)}")
        return jsonify({'error': 'No data provided'}), 400
    
    # Safely get values with defaults
    nickname = data.get('nickname', '')
    uuid = data.get('uuid', '')
    avatar_emoji = data.get('avatar_emoji', '🍺')
    
    # Strip only if not empty
    nickname = nickname.strip() if nickname else ''
    uuid = uuid.strip() if uuid else ''
    
    if not nickname or not uuid:
        logger.error(f"Missing fields - nickname: '{nickname}', uuid: '{uuid}'")
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Check if UUID already has account
        cursor.execute("SELECT user_id, nickname, passcode FROM users WHERE uuid = %s", (uuid,))
        existing = cursor.fetchone()
        
        if existing:
            # User exists but trying to create new account - needs passcode
            return jsonify({
                'success': False,
                'error': 'account_exists',
                'message': 'This device already has an account. Please sign in.',
                'existing_nickname': existing['nickname']
            }), 409
        
        # Check if nickname exists
        cursor.execute("SELECT user_id FROM users WHERE nickname = %s", (nickname,))
        if cursor.fetchone():
            return jsonify({'error': 'Nickname already taken'}), 409
        
        # Generate passcode
        passcode = generate_passcode()
        hashed_passcode = hash_passcode(passcode)
        
        # Create new user with passcode
        cursor.execute("""
            INSERT INTO users (uuid, nickname, avatar_emoji, passcode, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (uuid, nickname, avatar_emoji, hashed_passcode))
        
        user_id = cursor.lastrowid
        conn.commit()
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'nickname': nickname,
            'passcode': passcode,  # Return plain passcode ONLY on creation
            'message': 'Account created! Save your passcode!'
        })
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating user: {e}")
        return jsonify({'error': 'Failed to create account'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/signin', methods=['POST'])
def signin_user():
    """Sign in with nickname and passcode"""
    data = request.get_json()
    
    # Add safety check for null/None data
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Safely get and strip values, handling None cases
    nickname = (data.get('nickname') or '').strip()
    passcode = (data.get('passcode') or '').strip().upper()  # Normalize to uppercase
    uuid = (data.get('uuid') or '').strip()  # Device UUID for linking
    
    if not nickname or not passcode:
        return jsonify({'error': 'Nickname and passcode required'}), 400
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Find user by nickname
        cursor.execute("""
            SELECT user_id, nickname, avatar_emoji, passcode
            FROM users 
            WHERE nickname = %s
        """, (nickname,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify passcode
        if hash_passcode(passcode) != user['passcode']:
            return jsonify({'error': 'Invalid passcode'}), 401
        
        # Link this device to the user if UUID provided
        if uuid:
            cursor.execute("""
                UPDATE users 
                SET last_active = NOW() 
                WHERE user_id = %s
            """, (user['user_id'],))
            conn.commit()
        
        # Return user data (without passcode hash)
        del user['passcode']
        user['level'] = 1  # Calculate based on points if needed
        user['badges'] = []  # Load from badges table if implemented
        
        return jsonify({
            'success': True,
            'user': user,
            'message': 'Welcome back!'
        })
        
    except Exception as e:
        logger.error(f"Error signing in: {e}")
        return jsonify({'error': 'Sign in failed'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/reset-passcode', methods=['POST'])
def reset_passcode():
    """Generate new passcode for user (requires current passcode)"""
    data = request.get_json()
    nickname = data.get('nickname', '').strip()
    current_passcode = data.get('current_passcode', '').strip().upper()
    
    if not nickname or not current_passcode:
        return jsonify({'error': 'Nickname and current passcode required'}), 400
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Verify current passcode
        cursor.execute("""
            SELECT user_id, passcode FROM users WHERE nickname = %s
        """, (nickname,))
        
        user = cursor.fetchone()
        if not user or hash_passcode(current_passcode) != user['passcode']:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Generate new passcode
        new_passcode = generate_passcode()
        hashed_passcode = hash_passcode(new_passcode)
        
        # Update passcode
        cursor.execute("""
            UPDATE users 
            SET passcode = %s 
            WHERE user_id = %s
        """, (hashed_passcode, user['user_id']))
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'new_passcode': new_passcode,
            'message': 'Passcode reset successfully. Save your new passcode!'
        })
        
    except Exception as e:
        logger.error(f"Error resetting passcode: {e}")
        conn.rollback()
        return jsonify({'error': 'Failed to reset passcode'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/check-device/<uuid>')
def check_device(uuid):
    """Check if this device has an existing user"""
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT nickname, avatar_emoji 
            FROM users 
            WHERE uuid = %s
        """, (uuid,))
        
        user = cursor.fetchone()
        
        if user:
            return jsonify({
                'has_account': True,
                'nickname': user['nickname'],
                'avatar_emoji': user['avatar_emoji']
            })
        else:
            return jsonify({
                'has_account': False
            })
        
    except Exception as e:
        logger.error(f"Error checking device: {e}")
        return jsonify({'error': 'Check failed'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/<int:user_id>/points')
def get_user_points(user_id):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get points from user_stats VIEW (which sums from source tables)
        cursor.execute("""
            SELECT points 
            FROM user_stats 
            WHERE user_id = %s
        """, (user_id,))
        
        result = cursor.fetchone()
        points = result['points'] if result and result['points'] else 0
        
        return jsonify({
            'success': True,
            'points': points
        })
    except Exception as e:
        print(f"Error getting points: {e}")
        return jsonify({'success': False, 'points': 0})
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ================================================================================
# CORE ROUTES
# ================================================================================

@app.route('/')
def index():
    """Homepage"""
    version = str(int(time.time()))
    return render_template('index.html', cache_buster=version)

@app.route('/api/get-user-id/<nickname>', methods=['GET'])
def get_user_id(nickname):
    """Simply get user_id from nickname"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT us.user_id, u.nickname, us.points, us.level 
            FROM user_stats us
            LEFT JOIN users u
            ON us.user_id = u.user_id
            WHERE u.nickname = %s AND u.is_active = 1
        """, (nickname,))
        
        user = cursor.fetchone()
        
        if user:
            return jsonify({
                'success': True,
                'user_id': user['user_id'],
                'nickname': user['nickname'],
                'points': user['points'],
                'level': user['level']
            })
        else:
            return jsonify({'success': False, 'error': 'User not found'}), 404
            
    except Exception as e:
        logger.error(f"Error getting user ID: {str(e)}")
        return jsonify({'error': 'Failed to get user'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/stats')
def get_stats():
    """Get site statistics with new schema"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Total venues
        cursor.execute("SELECT COUNT(*) as total FROM venues")
        total_venues = cursor.fetchone()[0]
        
        # Venues with GF options
        cursor.execute("""
            SELECT COUNT(DISTINCT venue_id) as gf_total 
            FROM gf_status 
            WHERE status IN ('always_tap_cask','always_bottle_can', 'currently')
        """)
        gf_venues = cursor.fetchone()[0]

        # Venues with GF options this month
        cursor.execute("""
            SELECT COUNT(DISTINCT venue_id) as gf_total_this_month
            FROM gf_status 
            WHERE status IN ('always_tap_cask','always_bottle_can', 'currently')
            AND YEAR(updated_at) = YEAR(CURRENT_DATE())
            AND MONTH(updated_at) = MONTH(CURRENT_DATE())
        """)
        gf_venues_this_month = cursor.fetchone()[0]
        
        return jsonify({
            'total_venues': total_venues,
            'gf_venues': gf_venues,
            'gf_venues_this_month': gf_venues_this_month
        })
        
    except Exception as e:
        logger.error(f"Error in stats: {str(e)}")
        return jsonify({
            'total_venues': 67031,
            'gf_venues': 100,
            'gf_venues_this_month': 10 
        })
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/recent-finds')
def get_recent_finds():
    """Get recent venue beer discoveries with optional filtering"""
    try:
        # Get query parameters
        limit = request.args.get('limit', 2, type=int)
        filter_type = request.args.get('filter', 'all')  # all, today, week
        page = request.args.get('page', 1, type=int)
        
        # Validate parameters
        if limit > 100:
            limit = 100  # Cap at 100 for performance
        if page < 1:
            page = 1
            
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build WHERE clause based on filter
        where_clause = ""
        if filter_type == 'today':
            where_clause = "WHERE DATE(vb.last_seen) = CURDATE()"
        elif filter_type == 'week':
            where_clause = "WHERE vb.last_seen >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
        elif filter_type == 'month':
            where_clause = "WHERE vb.last_seen >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
        
        # Get the venue_beers entries with venue and beer details
        offset = (page - 1) * limit
        sql = f"""
            SELECT 
                vb.report_id,
                vb.venue_id,
                v.venue_name,
                v.city,
                v.postcode,
                vb.beer_id,
                b.beer_name,
                br.brewery_name,
                vb.format,
                vb.last_seen,
                u.nickname as added_by,
                u.avatar_emoji
            FROM venue_beers vb
            JOIN venues v ON vb.venue_id = v.venue_id
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            LEFT JOIN users u ON vb.user_id = u.user_id
            {where_clause}
            ORDER BY vb.last_seen DESC
            LIMIT %s OFFSET %s
        """
        
        cursor.execute(sql, (limit, offset))
        recent_finds = cursor.fetchall()
        
        # Get stats if requesting more than 2 (full view)
        stats = None
        if limit > 2:
            stats_sql = """
                SELECT 
                    COUNT(DISTINCT vb.beer_id) as total_beers,
                    COUNT(DISTINCT vb.venue_id) as total_venues,
                    COUNT(DISTINCT vb.user_id) as contributors
                FROM venue_beers vb
            """
            if where_clause:
                stats_sql += " " + where_clause
                
            cursor.execute(stats_sql)
            stats = cursor.fetchone()
        
        # Format the response
        formatted_finds = []
        for find in recent_finds:
            # Calculate time ago using last_seen
            time_diff = datetime.now().date() - find['last_seen']
            
            if time_diff.days == 0:
                time_ago = "Today"
            elif time_diff.days == 1:
                time_ago = "Yesterday"
            elif time_diff.days < 7:
                time_ago = f"{time_diff.days} days ago"
            elif time_diff.days < 30:
                weeks = time_diff.days // 7
                time_ago = f"{weeks} week{'s' if weeks > 1 else ''} ago"
            else:
                months = time_diff.days // 30
                time_ago = f"{months} month{'s' if months > 1 else ''} ago"
            
            # Format beer info
            beer_description = "Unknown beer"
            if find['beer_name'] and find['brewery_name']:
                beer_description = f"{find['brewery_name']} {find['beer_name']}"
            elif find['brewery_name']:
                beer_description = f"{find['brewery_name']} beer"
            
            # Format location
            location = find['city'] or 'Unknown location'
            if find['postcode']:
                location = f"{find['city']}, {find['postcode'][:4]}..."
            
            formatted_find = {
                'id': find['report_id'],
                'user_name': find['added_by'] if find['added_by'] else 'Anonymous User',
                'avatar_emoji': find['avatar_emoji'] if find['avatar_emoji'] else '🍺',
                'venue_id': find['venue_id'],
                'venue_name': find['venue_name'],
                'beer_description': beer_description,
                'format': find['format'],
                'location': location,
                'time_ago': time_ago,
                'added_at': find['last_seen'].isoformat() if find['last_seen'] else None
            }
            
            formatted_finds.append(formatted_find)
        
        response_data = {
            'success': True,
            'finds': formatted_finds,
            'count': len(formatted_finds),
            'filter': filter_type,
            'page': page
        }
        
        # Add stats if available
        if stats:
            response_data['stats'] = stats
            
        return jsonify(response_data)
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in recent finds: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Database error occurred'
        }), 500
        
    except Exception as e:
        logger.error(f"Error in recent finds: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500
        
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
@app.route('/api/community/trending')
def get_trending_beers():
    """Get trending beers from the last 7 days, fallback to all-time if none"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # First try: beers reported in the last 7 days
        cursor.execute("""
            SELECT 
                CONCAT(br.brewery_name, ' - ', b.beer_name) as beer_name,
                br.brewery_name,
                b.beer_name as name_only,
                COUNT(*) as report_count,
                COUNT(DISTINCT vb.venue_id) as venue_count
            FROM venue_beers vb
            JOIN beers b ON vb.beer_id = b.beer_id
            JOIN breweries br ON b.brewery_id = br.brewery_id
            WHERE vb.last_seen >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY b.beer_id, br.brewery_id
            ORDER BY report_count DESC
            LIMIT 3
        """)
        
        trending = cursor.fetchall()
        time_period = 'this_week'
        
        # If no results this week, get all-time top 5
        if not trending or len(trending) == 0:
            cursor.execute("""
                SELECT 
                    CONCAT(br.brewery_name, ' - ', b.beer_name) as beer_name,
                    br.brewery_name,
                    b.beer_name as name_only,
                    COUNT(*) as report_count,
                    COUNT(DISTINCT vb.venue_id) as venue_count
                FROM venue_beers vb
                JOIN beers b ON vb.beer_id = b.beer_id
                JOIN breweries br ON b.brewery_id = br.brewery_id
                GROUP BY b.beer_id, br.brewery_id
                ORDER BY report_count DESC
                LIMIT 5
            """)
            
            trending = cursor.fetchall()
            time_period = 'all_time'
        
        # Format for frontend
        formatted_trending = []
        for idx, item in enumerate(trending, 1):
            formatted_trending.append({
                'rank': idx,
                'beer_name': item['beer_name'],
                'brewery': item['brewery_name'],
                'report_count': item['report_count'],
                'venue_count': item['venue_count'],
                'hot': idx == 1 and time_period == 'this_week',  # Only hot if #1 this week
                'trend': 'up' if item['report_count'] > 10 else 'stable'
            })
        
        return jsonify({
            'success': True,
            'trending': formatted_trending,
            'time_period': time_period  # So frontend knows if it's weekly or all-time
        })
        
    except Exception as e:
        logger.error(f"Error getting trending beers: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/nearby')
def nearby():
    """Find nearby venues with pagination support"""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 5, type=int)
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    
    if not lat or not lng:
        return jsonify({'error': 'Latitude and longitude required'}), 400
    
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({'error': 'Invalid coordinates'}), 400
    
    if not (1 <= radius <= 50):
        return jsonify({'error': 'Invalid radius'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # First get total count
        count_sql = """
            SELECT COUNT(DISTINCT v.venue_id) as total
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
            AND (6371 * acos(cos(radians(%s)) * cos(radians(v.latitude)) * 
                cos(radians(v.longitude) - radians(%s)) + sin(radians(%s)) * 
                sin(radians(v.latitude)))) <= %s
        """
        
        count_params = [lat, lng, lat, radius]
        
        if gf_only:
            count_sql += " AND s.status IN ('always_tap_cask','always_bottle_can', 'currently')"
        
        cursor.execute(count_sql, count_params)
        total_count = cursor.fetchone()['total']
        
        # Now get paginated results
        per_page = 20
        offset = (page - 1) * per_page
        
        sql = """
            SELECT DISTINCT
                v.venue_id,
                v.venue_name,
                v.address,
                v.postcode,
                v.city,
                v.latitude,
                v.longitude,
                ANY_VALUE(COALESCE(s.status, 'unknown')) as gf_status,
                (6371 * acos(cos(radians(%s)) * cos(radians(v.latitude)) * 
                    cos(radians(v.longitude) - radians(%s)) + sin(radians(%s)) * 
                    sin(radians(v.latitude)))) AS distance,
                GROUP_CONCAT(
                    DISTINCT CONCAT(vb.format, ' - ', 
                    COALESCE(br.brewery_name, 'Unknown'), ' ', 
                    COALESCE(b.beer_name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            LEFT JOIN venue_beers vb ON v.venue_id = vb.venue_id
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
        """
        
        params = [lat, lng, lat]
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask','always_bottle_can', 'currently')"
        
        sql += """
            GROUP BY v.venue_id
            HAVING distance <= %s
            ORDER BY distance
            LIMIT %s OFFSET %s
        """
        params.extend([radius, per_page, offset])
        
        cursor.execute(sql, params)
        venues = cursor.fetchall()
        
        # Add local_authority field for frontend compatibility
        for venue in venues:
            venue['local_authority'] = venue['city']
            # Round distance for display
            if venue['distance']:
                venue['distance'] = round(venue['distance'], 2)
        
        return jsonify({
            'venues': venues,
            'pagination': {
                'page': page,
                'pages': (total_count + per_page - 1) // per_page,
                'total': total_count,
                'has_prev': page > 1,
                'has_next': page * per_page < total_count
            }
        })
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in nearby search: {str(e)}")
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/search')
def search():
    """Main search functionality with proper distance ordering"""
    query = request.args.get('query', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    venue_id = request.args.get('venue_id', type=int)
    country = request.args.get('country', 'GB')
    
    # Get user location for distance ordering
    user_lat = request.args.get('user_lat', type=float)
    user_lng = request.args.get('user_lng', type=float)
    
    if not query and not venue_id:
        # Check if this looks like a page refresh (accept header contains text/html)
        if 'text/html' in request.headers.get('Accept', ''):
            return redirect('/')
        # For AJAX calls, return empty results
        return jsonify({'error': 'Query is required for search'}), 400
    
    if query and (len(query) < 1 or len(query) > 100):
        return jsonify({'error': 'Invalid query length'}), 400
    
    if page < 1 or page > 1000:
        return jsonify({'error': 'Invalid page number'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Handle specific venue ID search
        if venue_id:
            sql = """
                SELECT DISTINCT
                    v.venue_id,
                    v.venue_name,
                    v.address,
                    v.postcode,
                    v.city,
                    v.latitude,
                    v.longitude,
                    ANY_VALUE(COALESCE(s.status, 'unknown')) as gf_status,
                    GROUP_CONCAT(
                        DISTINCT CONCAT(vb.format, ' - ', 
                        COALESCE(br.brewery_name, 'Unknown'), ' ', 
                        COALESCE(b.beer_name, 'Unknown'), ' (', 
                        COALESCE(b.style, 'Unknown'), ')')
                        SEPARATOR ', '
                    ) as beer_details
                FROM venues v
                LEFT JOIN gf_status s ON v.venue_id = s.venue_id
                LEFT JOIN venue_beers vb ON v.venue_id = vb.venue_id
                LEFT JOIN beers b ON vb.beer_id = b.beer_id
                LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
                WHERE v.venue_id = %s
            """
            
            if gf_only:
                sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
            
            sql += " GROUP BY v.venue_id"
            cursor.execute(sql, (venue_id,))
            venues = cursor.fetchall()
            return jsonify(venues)
        
        # Regular search logic
        if not query:
            return jsonify({'error': 'Query is required for search'}), 400
        
        # Build search condition
        if search_type == 'name':
            search_condition = "v.venue_name LIKE %s"
            search_params = [f'%{query}%']
        elif search_type == 'postcode':
            clean_postcode = query.upper().strip()
            
            # For ANY postcode (partial or full), we should:
            # 1. Try to geocode it to get coordinates
            # 2. Search nearby those coordinates
            
            # Only do prefix search for very short codes (S2, LS2)
            if len(clean_postcode) <= 4 and ' ' not in clean_postcode:
                # This is probably an area code - do prefix search
                search_condition = "v.postcode LIKE %s"
                search_params = [f'{clean_postcode}%']
            else:
                # This looks like a real postcode - geocode it!
                # Import at top: from app import geocodePostcode or requests
                try:
                    # Use Nominatim or postcodes.io to get coordinates
                    import requests
                    response = requests.get(f'https://api.postcodes.io/postcodes/{clean_postcode}')
                    if response.ok:
                        data = response.json()
                        lat = data['result']['latitude']
                        lon = data['result']['longitude']
                        
                        # Now search within 5km of these coordinates
                        # This is the ACTUAL nearby search they want!
                        search_condition = """
                            (6371 * acos(cos(radians(%s)) * cos(radians(v.latitude)) * 
                            cos(radians(v.longitude) - radians(%s)) + sin(radians(%s)) * 
                            sin(radians(v.latitude)))) <= 5
                        """
                        search_params = [lat, lon, lat]
                    else:
                        # Fallback to prefix if geocoding fails
                        search_condition = "v.postcode LIKE %s"
                        search_params = [f'{clean_postcode}%']
                except:
                    # Fallback
                    search_condition = "v.postcode LIKE %s"
                    search_params = [f'{clean_postcode}%']
        elif search_type == 'area':
            search_condition = "v.city LIKE %s"
            search_params = [f'%{query}%']
        else:
            search_condition = "(v.venue_name LIKE %s OR v.postcode LIKE %s OR v.city LIKE %s OR v.address LIKE %s)"
            search_params = [f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%']
        
        # Get ALL matching results first (no pagination yet)
        sql = f"""
            SELECT DISTINCT
                v.venue_id,
                v.venue_name,
                v.address,
                v.postcode,
                v.city,
                v.latitude,
                v.longitude,
                ANY_VALUE(COALESCE(s.status, 'unknown')) as gf_status,
                GROUP_CONCAT(
                    DISTINCT CONCAT(vb.format, ' - ', 
                    COALESCE(br.brewery_name, 'Unknown'), ' ', 
                    COALESCE(b.beer_name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            LEFT JOIN venue_beers vb ON v.venue_id = vb.venue_id
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            WHERE {search_condition}
        """
        
        params = search_params.copy()
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += " GROUP BY v.venue_id"
        
        cursor.execute(sql, params)
        all_venues = cursor.fetchall()
        
        # Add local_authority field for frontend compatibility
        for venue in all_venues:
            venue['local_authority'] = venue['city']
        
        # Sort by distance if user location provided
        if user_lat is not None and user_lng is not None:
            # Calculate distance for each venue and sort
            for venue in all_venues:
                if venue['latitude'] and venue['longitude']:
                    # FIXED Haversine formula
                    lat1 = math.radians(user_lat)
                    lon1 = math.radians(user_lng)
                    lat2 = math.radians(float(venue['latitude']))
                    lon2 = math.radians(float(venue['longitude']))
            
                    dlat = lat2 - lat1
                    dlon = lon2 - lon1
            
                    a = (math.sin(dlat/2)**2 + 
                 math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2)
                    c = 2 * math.asin(math.sqrt(a))
            
                    # Radius of earth in kilometers
                    r = 6371
                    distance = c * r
            
                    venue['distance'] = round(distance, 2)
                else:
                    venue['distance'] = 999  # Put venues without coordinates at the end
    
            # Sort by distance
            all_venues.sort(key=lambda x: x.get('distance', 999))
        else:
            # Sort alphabetically if no location
            all_venues.sort(key=lambda x: x['venue_name'])
        
        # Calculate pagination
        total_results = len(all_venues)
        per_page = 20
        total_pages = (total_results + per_page - 1) // per_page
        
        # Apply pagination to sorted results
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        venues = all_venues[start_idx:end_idx]
        
        # Return with pagination info
        return jsonify({
            'venues': venues,
            'pagination': {
                'page': page,
                'pages': total_pages,
                'total': total_results,
                'has_prev': page > 1,
                'has_next': page < total_pages
            }
        })
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in search: {str(e)}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/search-by-beer')
def search_by_beer():
    """Search venues by beer/brewery/style"""
    query = request.args.get('query', '').strip()
    search_type = request.args.get('beer_type', 'all')  # brewery/beer/style
    page = request.args.get('page', 1, type=int)
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    country = request.args.get('country', 'GB')
    
    if not query or len(query) < 2:
        return jsonify({'error': 'Query too short'}), 400
    
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build the WHERE clause based on search type
        if search_type == 'brewery':
            where_clause = "br.brewery_name LIKE %s"
            search_param = f'%{query}%'
        elif search_type == 'beer':
            where_clause = "b.beer_name LIKE %s"
            search_param = f'%{query}%'
        elif search_type == 'style':
            where_clause = "b.style LIKE %s"
            search_param = f'%{query}%'
        else:
            # Search all
            where_clause = "(br.brewery_name LIKE %s OR b.beer_name LIKE %s OR b.style LIKE %s)"
            search_param = None  # Will use multiple params
        
        # Get venues with beers matching the search
        sql = """
            SELECT DISTINCT
                v.venue_id,
                v.venue_name,
                v.address,
                v.postcode,
                v.city,
                v.latitude,
                v.longitude,
                v.country,
                ANY_VALUE(COALESCE(s.status, 'unknown')) as gf_status,
                GROUP_CONCAT(
                    DISTINCT CONCAT(vb.format, ' - ', 
                    COALESCE(br.brewery_name, 'Unknown'), ' ', 
                    COALESCE(b.beer_name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM venue_beers vb
            JOIN venues v ON vb.venue_id = v.venue_id
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            WHERE """ + where_clause
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += " GROUP BY v.venue_id"
        
        # Execute count query first
        count_sql = f"SELECT COUNT(DISTINCT v.venue_id) as total FROM venue_beers vb JOIN venues v ON vb.venue_id = v.venue_id LEFT JOIN beers b ON vb.beer_id = b.beer_id LEFT JOIN breweries br ON b.brewery_id = br.brewery_id LEFT JOIN gf_status s ON v.venue_id = s.venue_id WHERE {where_clause}"
        
        if search_param:
            cursor.execute(count_sql, (search_param,) if search_type != 'all' else (f'%{query}%', f'%{query}%', f'%{query}%'))
        else:
            cursor.execute(count_sql, (f'%{query}%', f'%{query}%', f'%{query}%'))
            
        total_count = cursor.fetchone()['total']
        
        # Add pagination
        per_page = 20
        offset = (page - 1) * per_page
        sql += f" LIMIT {per_page} OFFSET {offset}"
        
        # Execute main query
        if search_param:
            cursor.execute(sql, (search_param,))
        else:
            cursor.execute(sql, (f'%{query}%', f'%{query}%', f'%{query}%'))
        
        venues = cursor.fetchall()
        
        # Add local_authority for frontend
        for venue in venues:
            venue['local_authority'] = venue['city']
        
        return jsonify({
            'venues': venues,
            'pagination': {
                'page': page,
                'pages': (total_count + per_page - 1) // per_page,
                'total': total_count,
                'has_prev': page > 1,
                'has_next': page * per_page < total_count
            }
        })
        
    except Exception as e:
        logger.error(f"Beer search error: {str(e)}")
        return jsonify({'error': 'Search failed'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/submit_beer_update', methods=['POST'])
def submit_beer_update():
    """Submit beer report - cleaner version with just user_id"""
    try:
        data = request.get_json()
        logger.info(f"Received beer report data: {data}")
        
        # Get user info - ONLY need user_id now
        user_id = data.get('user_id')
        
        # Validate user_id exists
        if not user_id:
            logger.warning("Beer report submitted without user_id")
            return jsonify({'error': 'User authentication required'}), 401
        
        venue_id = data.get('venue_id')
        format_type = data.get('format') or data.get('beer_format')
        brewery_name = data.get('brewery_name')
        beer_name = data.get('beer_name')
        beer_style = data.get('beer_style')
        beer_abv = data.get('beer_abv')
        
        if not all([venue_id, format_type, brewery_name, beer_name]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Verify user exists and is active
        cursor.execute("""
            SELECT user_id, nickname FROM users 
            WHERE user_id = %s AND is_active = 1
        """, (user_id,))
        
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Invalid user'}), 401
        
        # STEP 1: Check if brewery exists, if not add it
        cursor.execute("""
            SELECT brewery_id FROM breweries 
            WHERE LOWER(brewery_name) = LOWER(%s)
        """, (brewery_name,))
        
        brewery_rows = cursor.fetchall()
        
        if brewery_rows:
            brewery_id = brewery_rows[0]['brewery_id']
            logger.info(f"Found existing brewery: {brewery_name} (ID: {brewery_id})")
        else:
            # Add new brewery - ONLY store user_id
            cursor.execute("SELECT MAX(brewery_id) as max_id FROM breweries")
            max_rows = cursor.fetchall()
            max_brewery_id = max_rows[0]['max_id'] if max_rows[0]['max_id'] else 0
            brewery_id = max_brewery_id + 1
            
            cursor.execute("""
                INSERT INTO breweries (brewery_id, brewery_name, created_by_id)
                VALUES (%s, %s, %s)
            """, (brewery_id, brewery_name, user_id))
            
            logger.info(f"Added new brewery: {brewery_name} (ID: {brewery_id}) by user {user_id}")
        
        # STEP 2: Check if beer exists, if not add it
        cursor.execute("""
            SELECT beer_id FROM beers 
            WHERE brewery_id = %s AND LOWER(beer_name) = LOWER(%s)
        """, (brewery_id, beer_name))
        
        beer_rows = cursor.fetchall()
        
        if beer_rows:
            beer_id = beer_rows[0]['beer_id']
            logger.info(f"Found existing beer: {beer_name} (ID: {beer_id})")
        else:
            # Add new beer - ONLY store user_id
            cursor.execute("SELECT MAX(beer_id) as max_id FROM beers")
            max_rows = cursor.fetchall()
            max_beer_id = max_rows[0]['max_id'] if max_rows[0]['max_id'] else 0
            beer_id = max_beer_id + 1
            
            abv_value = None
            if beer_abv:
                try:
                    abv_value = float(beer_abv)
                except (ValueError, TypeError):
                    abv_value = None
            
            cursor.execute("""
                INSERT INTO beers (brewery_id, beer_id, beer_name, style, abv, gluten_status, created_by_id)
                VALUES (%s, %s, %s, %s, %s, 'gluten_removed', %s)
            """, (brewery_id, beer_id, beer_name, beer_style, abv_value, user_id))
            
            logger.info(f"Added new beer: {brewery_name} - {beer_name} (ID: {beer_id}) by user {user_id}")
        
        # STEP 3: Check if this beer is already reported for this venue
        cursor.execute("""
            SELECT report_id FROM venue_beers 
            WHERE venue_id = %s AND beer_id = %s AND format = %s
        """, (venue_id, beer_id, format_type))
        
        existing_reports = cursor.fetchall()
        
        if existing_reports:
            existing_report = existing_reports[0]
            # Update existing report - ONLY user_id
            cursor.execute("""
                UPDATE venue_beers 
                SET last_seen = CURRENT_DATE,
                    user_id = %s
                WHERE report_id = %s
            """, (user_id, existing_report['report_id']))
            report_id = existing_report['report_id']
            logger.info(f"Updated existing report {report_id} by user {user_id}")
        else:
            # Insert new report - ONLY user_id
            cursor.execute("""
                INSERT INTO venue_beers (venue_id, beer_id, user_id, format, last_seen)
                VALUES (%s, %s, %s, %s, CURRENT_DATE)
            """, (venue_id, beer_id, user_id, format_type))
            report_id = cursor.lastrowid
            logger.info(f"Added new venue_beer report {report_id} by user {user_id}")
        
        conn.commit()
        
        # Update user stats and points
        points_earned = 15
        update_user_stats(user_id, 'beer_report', points_earned)
        logger.info(f"Awarded {points_earned} points to user {user_id} ({user['nickname']})")
        
        return jsonify({
            'success': True,
            'message': '🎉 Beer report added successfully!',
            'report_id': report_id,
            'beer_id': beer_id,
            'brewery_id': brewery_id,
            'status': 'approved',
            'show_status_prompt': True,
            'points_earned': points_earned,
            'contributor': user['nickname']  # Can still return nickname for display
        })
        
    except Exception as e:
        logger.error(f"Error in submit_beer_update: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to process beer report. Please try again.'
        }), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/update-gf-status', methods=['POST'])
def update_gf_status():
    """Update GF status - cleaner version with just user_id"""
    try:
        data = request.get_json()
        venue_id = data.get('venue_id')
        new_status = data.get('status')
        user_id = data.get('user_id')
        
        if not venue_id or not new_status:
            return jsonify({'error': 'Missing venue_id or status'}), 400
        
        if not user_id:
            return jsonify({'error': 'User authentication required'}), 401
            
        valid_statuses = ['always_tap_cask', 'always_bottle_can', 'currently', 'not_currently', 'unknown']
        
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Verify user exists
        cursor.execute("SELECT nickname FROM users WHERE user_id = %s AND is_active = 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Invalid user'}), 401
        
        # Get current status for audit trail
        cursor.execute("SELECT status FROM gf_status WHERE venue_id = %s", (venue_id,))
        current_row = cursor.fetchone()
        old_status = current_row['status'] if current_row else 'unknown'
        
        # FIX 1: Check if status is actually changing
        if old_status == new_status:
            conn.close()
            logger.info(f"Status unchanged for venue {venue_id}: {new_status} (skipped duplicate)")
            return jsonify({
                'success': True,
                'message': f'Status already set to {new_status}',
                'status': new_status,
                'duplicate': True,
                'points_earned': 0
            })
        
        # Insert into status_updates table - ONLY user_id
        cursor.execute("""
            INSERT INTO status_updates (venue_id, old_status, new_status, user_id, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (venue_id, old_status, new_status, user_id))
        
        conn.commit()
        
        # Update user stats and points
        points_earned = 5
        update_user_stats(user_id, 'status_update', points_earned)
        
        logger.info(f"Updated venue {venue_id} GF status from {old_status} to {new_status} by user {user_id} ({user['nickname']})")
        
        return jsonify({
            'success': True,
            'message': f'Status updated to {new_status}',
            'status': new_status,
            'changed': True,
            'points_earned': points_earned,
            'contributor': user['nickname']  # Can still return for display
        })
        
    except Exception as e:
        logger.error(f"Error updating GF status: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'error': f'Failed to update status: {str(e)}'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/venue/<int:venue_id>/status-confirmations')
def get_status_confirmations(venue_id):
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    # Get most recent confirmation and count of unique users in last 7 days
    cursor.execute("""
        SELECT 
            COUNT(DISTINCT user_id) as confirmer_count,
            MAX(confirmed_at) as last_confirmed,
            TIMESTAMPDIFF(HOUR, MAX(confirmed_at), NOW()) as hours_ago
        FROM status_confirmations 
        WHERE venue_id = %s 
        AND confirmed_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    """, (venue_id,))
    
    result = cursor.fetchone()
    
    # Format the response
    if result and result['confirmer_count'] > 0:
        if result['hours_ago'] < 24:
            time_text = f"{result['hours_ago']} hours ago"
        else:
            days = result['hours_ago'] // 24
            time_text = f"{days} day{'s' if days > 1 else ''} ago"
            
        return jsonify({
            'text': f"Last confirmed: {time_text} by {result['confirmer_count']} user{'s' if result['confirmer_count'] > 1 else ''}",
            'has_confirmations': True
        })
    else:
        return jsonify({
            'text': "Not yet confirmed",
            'has_confirmations': False
        })

@app.route('/api/venue/confirm-status', methods=['POST'])
def confirm_venue_status():
    """Confirm a venue's GF status"""
    try:
        data = request.get_json()
        venue_id = data.get('venue_id')
        status = data.get('status')
        user_id = data.get('user_id')
        
        if not venue_id or not status or not user_id:
            return jsonify({'error': 'Missing required fields'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT nickname FROM users WHERE user_id = %s AND is_active = 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Invalid user'}), 401
        
        # Check if user already confirmed this status in last 24 hours
        cursor.execute("""
            SELECT confirmed_at 
            FROM status_confirmations 
            WHERE venue_id = %s 
            AND user_id = %s 
            AND confirmed_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
        """, (venue_id, user_id))
        
        recent_confirmation = cursor.fetchone()
        
        if recent_confirmation:
            return jsonify({
                'success': False,
                'message': 'You already confirmed this venue today',
                'points_earned': 0
            }), 200
        
        # Insert confirmation
        cursor.execute("""
            INSERT INTO status_confirmations (venue_id, user_id, status_confirmed, confirmed_at)
            VALUES (%s, %s, %s, NOW())
        """, (venue_id, user_id, status))
        
        conn.commit()
        
        # Award points
        points_earned = 5
        update_user_stats(user_id, 'status_confirmation', points_earned)
        
        logger.info(f"Status confirmed for venue {venue_id} by user {user_id} ({user['nickname']})")
        
        return jsonify({
            'success': True,
            'message': 'Status confirmed!',
            'points_earned': points_earned
        })
        
    except Exception as e:
        logger.error(f"Error confirming status: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'error': 'Failed to confirm status'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
                    
@app.route('/autocomplete')
def autocomplete():
    """Autocomplete suggestions for search"""
    query = request.args.get('q', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    
    if not query or len(query) < 2 or len(query) > 100:
        return jsonify([])

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build search condition for new schema
        if search_type == 'name':
            search_condition = "v.venue_name LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'postcode':
            search_condition = "v.postcode LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'area':
            search_condition = "v.city LIKE %s"
            params = (f'%{query}%',)
        else:
            search_condition = "(v.venue_name LIKE %s OR v.postcode LIKE %s OR v.city LIKE %s OR v.address LIKE %s)"
            params = (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%')
        
        # Updated query for new schema
        sql = f"""
            SELECT v.venue_id, v.venue_name, 
                   v.address, 
                   v.postcode
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += " ORDER BY v.venue_name"
        cursor.execute(sql, params)
        venues = cursor.fetchall()
        
        return jsonify(venues)
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in autocomplete: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/community/leaderboard')
def get_community_leaderboard():
    """Get top contributors using the user_stats view"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get all user stats from the view
        cursor.execute("""
            SELECT 
                u.nickname, 
                us.points, 
                us.beers_reported, 
                us.statuses_confirmed, 
                us.statuses_updated, 
                us.venues_reported, 
                us.venues_added
            FROM user_stats us
            LEFT JOIN users u ON us.user_id = u.user_id
            WHERE u.nickname IS NOT NULL
            ORDER BY us.points DESC
            LIMIT 20
        """)
        
        leaderboard = []
        for row in cursor.fetchall():
            # Calculate total contributions
            total_contributions = (row['beers_reported'] or 0) + (row['statuses_updated'] or 0) + (row['venues_added'] or 0)
            
            # Calculate unique venues touched
            venues_touched = (row['venues_reported'] or 0) + (row['venues_added'] or 0)
            
            leaderboard.append({
                'nickname': row['nickname'],
                'points': row['points'] or 0,
                'contributions': total_contributions,
                'beer_reports': row['beers_reported'] or 0,
                'status_updates': row['statuses_updated'] or 0,
                'venues_touched': venues_touched,
                'status_confirmations': row['statuses_confirmed'] or 0
            })
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard
        })
        
    except Exception as e:
        logger.error(f"Leaderboard error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# Add these to your app.py

@app.route('/api/user/check-nickname')
def check_nickname():
    nickname = request.args.get('nickname', '').strip()
    
    if not nickname or len(nickname) < 3:
        return jsonify({'available': False, 'error': 'Too short'})
    
    # Check if it's a bad word or inappropriate
    banned_words = ['admin', 'administrator', 'root', 'system']
    if nickname.lower() in banned_words:
        return jsonify({'available': False, 'error': 'Reserved name'})
    
    conn = mysql.connector.connect(**db_config)  # FIXED: Use the same connection method
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT COUNT(*) FROM users WHERE nickname = %s", (nickname,))
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            # Generate suggestions
            suggestions = []
            for suffix in ['_UK', str(random.randint(1, 99)), '_GF', '2025']:
                suggestions.append(f"{nickname}{suffix}")
            
            return jsonify({
                'available': False, 
                'message': 'Already taken',
                'suggestions': suggestions
            })
        
        return jsonify({'available': True})
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/get/<uuid>')
def get_user(uuid):
    conn = mysql.connector.connect(**db_config)  # FIXED
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Only select columns that actually exist in your users table
        cursor.execute("""
            SELECT us.user_id, nickname, points
            FROM users_stats us
            LEFT JOIN users u
            ON us.user_id = u.user_id
            WHERE uuid = %s
        """, (uuid,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Add default values for missing fields
        user['avatar_emoji'] = '🍺'
        user['level'] = 1
        user['beers_reported'] = 0
        user['venues_added'] = 0
        user['statuses_updated'] = 0
        user['badges'] = []
        
        return jsonify(user)
        
    except Exception as e:
        print(f"Error getting user: {e}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/user/update-active/<uuid>', methods=['POST'])
def update_last_active(uuid):
    conn = mysql.connector.connect(**db_config)  # FIXED
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE users 
            SET last_active = NOW() 
            WHERE uuid = %s
        """, (uuid,))
        
        conn.commit()
        return jsonify({'success': True})
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/community/my-stats/<nickname>')
def get_user_stats(nickname):
    """Get real stats for a specific user"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()


        cursor.execute("""
            SELECT us.points, us.beers_reported, us.statuses_confirmed, us.statuses_updated, us.venues_reported, us.venues_added
            FROM user_stats us
            LEFT JOIN users u ON us.user_id = u.user_id
            WHERE nickname = %s
        """, (nickname,))
        all_stats = cursor.fetchone()
        
        # Get beer contributions
        cursor.execute("""
            SELECT COUNT(*) as count, COUNT(DISTINCT venue_id) as venues
            FROM venue_beers vb
            LEFT JOIN users u ON vb.user_id = u.user_id
            WHERE nickname = %s
        """, (nickname,))
        beer_stats = cursor.fetchone()
        
        # Get status updates
        cursor.execute("""
            SELECT COUNT(*) as count, COUNT(DISTINCT venue_id) as venues
            FROM status_updates s
            LEFT JOIN users u ON s.user_id = u.user_id
            WHERE nickname = %s
        """, (nickname,))
        status_stats = cursor.fetchone()
        
        # Calculate totals
        total_beers = all_stats[1] if all_stats else 0
        total_statuses = all_stats[2] if all_stats else 0
        unique_venues = all_stats[4] if all_stats else 0
        
        # Calculate points
        points = (total_beers * 15) + (total_statuses * 5) + (unique_venues * 10)
        
        return jsonify({
            'success': True,
            'stats': {
                'beers_reported': total_beers,
                'status_updates': total_statuses,
                'venues_updated': unique_venues,
                'total_contributions': total_beers + total_statuses,
                'points': points,
                'people_helped': unique_venues * 5  # Rough estimate
            }
        })
        
    except Exception as e:
        logger.error(f"User stats error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ================================================================================
# API ROUTES
# ================================================================================

@app.route('/api/beers/search', methods=['GET'])
def search_beers_globally():
    """Search all beers in database (for when user doesn't know brewery)"""
    query = request.args.get('q', '').strip()
    
    if not query or len(query) < 2:
        return jsonify([])
    
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Search beers and include brewery info
        cursor.execute("""
            SELECT 
                b.beer_id,
                b.beer_name,
                br.brewery_name,
                b.style,
                b.abv,
                b.gluten_status
            FROM beers b
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            WHERE b.beer_name LIKE %s
            ORDER BY 
                CASE 
                    WHEN b.beer_name LIKE %s THEN 0
                    WHEN b.beer_name LIKE %s THEN 1
                    ELSE 2
                END,
                b.beer_name
            LIMIT 20
        """, (f'%{query}%', f'{query}%', f'%{query}%'))
        
        beers = cursor.fetchall()
        
        # Convert Decimal to float for JSON serialization
        for beer in beers:
            if beer['abv']:
                beer['abv'] = float(beer['abv'])
        
        cursor.close()
        conn.close()
        
        return jsonify(beers)
        
    except Exception as e:
        logger.error(f"Error searching beers: {str(e)}")
        return jsonify([]), 500

@app.route('/api/breweries', methods=['GET'])
def get_breweries():
    """Get breweries for autocomplete"""
    query = request.args.get('q', '').strip()
    
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        if query:
            cursor.execute("""
                SELECT DISTINCT brewery_name
                FROM breweries 
                WHERE brewery_name LIKE %s
                ORDER BY brewery_name
            """, (f'%{query}%',))
        else:
            cursor.execute("""
                SELECT DISTINCT brewery_name 
                FROM breweries 
                ORDER BY brewery_name
            """)
        
        breweries = [row[0] for row in cursor.fetchall()]
        return jsonify(breweries)
        
    except Exception as e:
        logger.error(f"Error fetching breweries: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/brewery/<brewery_name>/beers', methods=['GET'])
def get_brewery_beers(brewery_name):
    """Get beers for a specific brewery"""
    query = request.args.get('q', '').strip()
    
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        if query:
            cursor.execute("""
                SELECT beer_id, beer_name, style, abv, gluten_status, vegan_status
                FROM beers b
                LEFT JOIN breweries br
                ON b.brewery_id = br.brewery_id
                WHERE brewery_name = %s AND beer_name LIKE %s
                ORDER BY beer_name
            """, (brewery_name, f'%{query}%'))
        else:
            cursor.execute("""
                SELECT beer_id, beer_name, style, abv, gluten_status, vegan_status
                FROM beers b
                LEFT JOIN breweries br
                ON b.brewery_id = br.brewery_id
                WHERE brewery_name = %s
                ORDER BY beer_name
            """, (brewery_name,))
        
        beers = cursor.fetchall()
        return jsonify(beers)
        
    except Exception as e:
        logger.error(f"Error fetching beers for {brewery_name}: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/venue/<int:venue_id>/beers', methods=['GET'])
def get_venue_beers(venue_id):
    """Get structured beer data for a venue"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                vb.beer_id as id,
                br.brewery_name as brewery,
                b.beer_name as name,            
                b.style,
                vb.format,
                vb.last_seen as added_date,
                u.nickname as added_by
            FROM venue_beers vb
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            LEFT JOIN users u ON u.user_id = vb.user_id
            WHERE vb.venue_id = %s
            ORDER BY vb.format, b.beer_name
        """, (venue_id,))
        
        beers = cursor.fetchall()
        
        # Process dates since JSON can't serialize datetime directly
        for beer in beers:
            if beer['added_date']:
                beer['added_date'] = beer['added_date'].isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'venue_id': venue_id,
            'beers': beers,
            'count': len(beers)
        })
        
    except Exception as e:
        print(f"Error in get_venue_beers: {e}")
        return jsonify({'venue_id': venue_id, 'beers': [], 'count': 0}), 200
                

@app.route('/api/all-venues')
def get_all_venues_for_map():
    """Get all venues with coordinates for map display"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Updated query for new schema
        cursor.execute("""
            SELECT 
                v.venue_id as venue_id, v.venue_name, 
                v.address, 
                v.postcode, v.city,
                v.latitude, v.longitude,
                COALESCE(s.status, 'unknown') as gf_status
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL 
            AND v.latitude != 0 AND v.longitude != 0            
            ORDER BY s.status ASC
        """)
        
        venues = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'venues': venues,
            'total': len(venues)
        })
        
    except Exception as e:
        logger.error(f"Error fetching all venues: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to load venues'
        }), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/add-venue', methods=['POST'])
def add_venue():
    """Add a new venue to the database"""
    conn = None
    try:
        data = request.get_json()
        
        # Log incoming data for debugging
        logger.info(f"Add venue request: {data}")
        
        # Get user_id instead of submitted_by
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        # Validate required fields
        required_fields = ['venue_name', 'address', 'postcode']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Verify user exists (same as status update)
        cursor.execute("SELECT nickname FROM users WHERE user_id = %s AND is_active = 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'Invalid user'}), 401
        
        # Check if venue already exists
        cursor.execute("""
            SELECT venue_id FROM venues 
            WHERE LOWER(venue_name) = LOWER(%s) AND postcode = %s
        """, (data['venue_name'], data['postcode']))
        
        existing = cursor.fetchone()
        if existing:
            return jsonify({
                'success': False,
                'error': 'A venue with this name and postcode already exists',
                'venue_id': existing['venue_id']  # Note: dictionary cursor means existing['venue_id'] not existing[0]
            }), 409
        
        # Parse the address to extract components
        address_parts = data['address'].split(',')
        street = address_parts[0].strip() if len(address_parts) > 0 else ''
        city = address_parts[-1].strip() if len(address_parts) > 1 else ''
        
        # Determine venue_type from Google Places data or default to 'pub'
        venue_type = 'pub'  # Default fallback
        
        if 'types' in data and data['types']:
            google_types = data['types']
            if 'bar' in google_types:
                venue_type = 'bar'
            elif 'restaurant' in google_types:
                venue_type = 'restaurant' 
            elif 'lodging' in google_types:
                venue_type = 'hotel'
            elif 'night_club' in google_types:
                venue_type = 'club'
        
        # Insert new venue with user_id in added_by_user_id column
        cursor.execute("""
            INSERT INTO venues (
                venue_name, street, city, postcode, 
                address, latitude, longitude, 
                venue_type, added_by_user_id
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            data['venue_name'],
            street,
            city,
            data['postcode'],
            data['address'],
            data.get('latitude'),
            data.get('longitude'),
            venue_type,
            user_id  # Use user_id instead of submitted_by
        ))
        
        venue_id = cursor.lastrowid
        conn.commit()
        
        # Award points for adding venue (20 points)
        points_earned = 20
        update_user_stats(user_id, 'venue_add', points_earned)
        
        # Log the addition with user info
        logger.info(f"New venue added: {data['venue_name']} (ID: {venue_id}) as {venue_type} by user {user_id} ({user['nickname']})")
        
        cursor.close()
        conn.close()
        conn = None
        
        return jsonify({
            'success': True,
            'message': f'{data["venue_name"]} added successfully!',
            'venue_id': venue_id,
            'venue_type': venue_type,
            'points_earned': points_earned,
            'contributor': user['nickname']  # Can return nickname for display
        })
        
    except mysql.connector.IntegrityError as e:
        logger.error(f"Database integrity error: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'This venue may already exist in our database'
        }), 409
        
    except mysql.connector.Error as e:
        logger.error(f"MySQL error in add_venue: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}'
        }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in add_venue: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to add venue. Please try again.'
        }), 500
        
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/search-places', methods=['POST'])
def search_places():
    """Proxy to Google Places API to hide API key"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({'results': []})
        
        api_key = os.getenv('GOOGLE_PLACES_API_KEY')
        if not api_key:
            logger.error('Google Places API key not configured')
            return jsonify({'error': 'Places API not configured'}), 500
        
        # Search for venues in UK
        places_url = f"https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            'query': f"{query} bar pub restaurant UK",
            'key': api_key,
            'region': 'uk'
        }
        
        logger.info(f"Searching Google Places for: {query}")
        response = requests.get(places_url, params=params, timeout=10)
        
        if response.status_code == 200:
            places_data = response.json()
            logger.info(f"Google Places returned {len(places_data.get('results', []))} results")
            return jsonify(places_data)
        else:
            logger.error(f"Google Places API error: {response.status_code} - {response.text}")
            return jsonify({'error': 'Places search failed', 'status': response.status_code}), 500
            
    except requests.exceptions.Timeout:
        logger.error('Google Places API timeout')
        return jsonify({'error': 'Search timeout - please try again'}), 504
    except requests.exceptions.RequestException as e:
        logger.error(f'Google Places API request error: {str(e)}')
        return jsonify({'error': 'Network error - please try again'}), 503
    except Exception as e:
        logger.error(f'Places API error: {str(e)}')
        return jsonify({'error': 'Search failed - please try again'}), 500





def update_user_stats(user_id, action_type, points):
    """Update user statistics and points"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Log the action
        logger.info(f"Updating stats for user {user_id}: {action_type} (+{points} points)")
        
        # The user_stats VIEW will automatically calculate totals
        # We just need to ensure the source data is updated
        # The points come from counting records in venue_beers and status_updates
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Error updating user stats: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()





# ================================================================================
# ADMIN ROUTES
# ================================================================================

@app.route('/admin')
def admin_dashboard():
    token = request.args.get('token')
    expected_token = os.getenv('ADMIN_TOKEN', 'beer_admin_2025')
    
    if not token or token != expected_token:
        return "🔒 Access denied. Admin token required.", 403
    
    return render_template('admin.html')

@app.route('/api/admin/stats')
@admin_required
def get_admin_stats():
    """Get basic admin statistics"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Total venue_beers reports
        cursor.execute("SELECT COUNT(*) as count FROM venue_beers")
        total_reports = cursor.fetchone()['count']
        
        # Today's reports
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM venue_beers
            WHERE DATE(added_at) = CURDATE()
        """)
        today_reports = cursor.fetchone()['count']
        
        # Total beers
        cursor.execute("SELECT COUNT(*) as count FROM beers")
        total_beers = cursor.fetchone()['count']
        
        return jsonify({
            'total_submissions': total_reports,
            'today_submissions': today_reports,
            'total_beers': total_beers
        })
        
    except Exception as e:
        logger.error(f"Error getting admin stats: {str(e)}")
        return jsonify({'error': 'Failed to load stats'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ================================================================================
# HEALTH & STATIC PAGES
# ================================================================================

@app.route('/health')
def health_check():
    """Health check endpoint"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': time.time(),
            'database': 'connected'
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'timestamp': time.time(),
            'database': 'disconnected',
            'error': str(e)
        }), 503

@app.route('/privacy')
def privacy_policy():
    version = str(int(time.time()))
    return render_template('privacy.html', cache_buster=version)

@app.route('/terms')
def terms_of_service():
    version = str(int(time.time()))
    return render_template('terms.html', cache_buster=version)

@app.route('/cookies')
def cookie_policy():
    version = str(int(time.time()))
    return render_template('cookies.html', cache_buster=version)

@app.route('/accessibility')
def accessibility_statement():
    version = str(int(time.time()))
    return render_template('accessibility.html', cache_buster=version)

@app.route('/liability')
def liability_notice():
    version = str(int(time.time()))
    return render_template('liability.html', cache_buster=version)

@app.route('/breweries')
def gf_breweries():
    version = str(int(time.time()))
    return render_template('breweries.html', cache_buster=version)

@app.route('/search')
@app.route('/venue')
@app.route('/map')
@app.route('/breweries')
def spa_routes():
    """Handle client-side routing - always return index"""
    version = str(int(time.time()))
    return render_template('index.html', cache_buster=version)

@app.route('/<path:path>')
def catch_all(path):
    """Catch-all route for SPA - always return index for unknown routes"""
    # List of actual API endpoints that should 404
    api_routes = ['api', 'admin', 'health', 'nearby', 'autocomplete']
    
    # If it's an API route, let it 404 normally
    if path.startswith(tuple(api_routes)):
        return jsonify({'error': 'Not found'}), 404
    
    # Otherwise, serve the main app (SPA routing)
    version = str(int(time.time()))
    return render_template('index.html', cache_buster=version)

# ================================================================================
# ERROR HANDLERS
# ================================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

# ================================================================================
# MAIN
# ================================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting app on port {port}, debug mode: {debug}")
    app.run(debug=debug, host='0.0.0.0', port=port)
































