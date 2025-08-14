# ================================================================================
# COELIACS LIKE BEER TOO - UPDATED APP.PY FOR OSM SCHEMA
# ================================================================================

from flask import Flask, request, jsonify, render_template
import mysql.connector
import os
from dotenv import load_dotenv
import logging
import time
import json
from datetime import datetime, timedelta
import requests
from math import sin, cos, sqrt, atan2

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

# ================================================================================
# CORE ROUTES
# ================================================================================

@app.route('/')
def index():
    """Homepage"""
    version = str(int(time.time()))
    return render_template('index.html', cache_buster=version)

# ====================================================================
# RECENT FINDS API ENDPOINT
# ====================================================================

@app.route('/api/recent-finds')
def get_recent_finds():
    """Get the 2 most recent venue beer discoveries"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get the 2 most recent venue_beers entries with venue and beer details
        sql = """
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
                vb.added_at,
                vb.added_by,
                vb.times_reported
            FROM venue_beers vb
            JOIN venues v ON vb.venue_id = v.venue_id
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
            ORDER BY vb.added_at DESC
            LIMIT 2
        """
        
        cursor.execute(sql)
        recent_finds = cursor.fetchall()
        
        # Format the response
        formatted_finds = []
        for find in recent_finds:
            # Calculate time ago
            time_diff = datetime.now() - find['added_at']
            
            if time_diff.total_seconds() < 3600:  # Less than 1 hour
                time_ago = f"{int(time_diff.total_seconds() / 60)} minutes ago"
            elif time_diff.total_seconds() < 86400:  # Less than 1 day
                time_ago = f"{int(time_diff.total_seconds() / 3600)} hours ago"
            else:
                time_ago = f"{time_diff.days} days ago"
            
            # Format beer info
            beer_description = "Unknown beer"
            if find['beer_name'] and find['brewery_name']:
                beer_description = f"{find['brewery_name']} {find['beer_name']}"
            elif find['brewery_name']:
                beer_description = f"{find['brewery_name']} beer"
            
            # Format location
            location = find['city']
            if find['postcode']:
                location = f"{find['city']}, {find['postcode'][:4]}..."
            
            formatted_find = {
                'id': find['report_id'],
                'user_name': find['added_by'] if find['added_by'] != 'anonymous' else 'Anonymous User',
                'venue_id': find['venue_id'],
                'venue_name': find['venue_name'],
                'beer_description': beer_description,
                'format': find['format'],
                'location': location,
                'time_ago': time_ago,
                'added_at': find['added_at'].isoformat(),
                'times_reported': find['times_reported'] or 1
            }
            
            formatted_finds.append(formatted_find)
        
        return jsonify({
            'success': True,
            'finds': formatted_finds,
            'count': len(formatted_finds)
        })
        
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

@app.route('/nearby')
def nearby():
    """Find nearby venues with new schema"""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 5, type=int)
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    
    if not lat or not lng:
        return jsonify({'error': 'Latitude and longitude required'}), 400
    
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({'error': 'Invalid coordinates'}), 400
    
    if not (1 <= radius <= 50):
        return jsonify({'error': 'Invalid radius'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT DISTINCT
                v.venue_id
                ,v.venue_name
                ,v.address
                ,v.postcode
                ,v.city
                ,v.latitude
                ,v.longitude
                ,COALESCE(s.status, 'unknown') as gf_status
                ,(6371 * acos(cos(radians(%s)) * cos(radians(v.latitude)) * cos(radians(v.longitude) - radians(%s)) + sin(radians(%s)) * sin(radians(v.latitude)))) AS distance
                ,GROUP_CONCAT(
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
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += """
            GROUP BY v.venue_id
            HAVING distance <= %s
            ORDER BY distance
            LIMIT 20
        """
        params.append(radius)
        
        cursor.execute(sql, params)
        venues = cursor.fetchall()
        
        # Add local_authority field for frontend compatibility
        for venue in venues:
            venue['local_authority'] = venue['city']
        
        return jsonify(venues)
        
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
    
    # Get user location for distance ordering
    user_lat = request.args.get('user_lat', type=float)
    user_lng = request.args.get('user_lng', type=float)
    
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
                    COALESCE(s.status, 'unknown') as gf_status,
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
            search_condition = "v.postcode LIKE %s"
            search_params = [f'%{query}%']
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
                COALESCE(s.status, 'unknown') as gf_status,
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
                    # Calculate distance using Haversine formula
                    lat1, lon1 = user_lat, user_lng
                    lat2, lon2 = float(venue['latitude']), float(venue['longitude'])
                    
                    R = 6371  # Earth's radius in km
                    dLat = (lat2 - lat1) * 3.14159 / 180
                    dLon = (lon2 - lon1) * 3.14159 / 180
                    a = (sin(dLat/2) * sin(dLat/2) + 
                         cos(lat1 * 3.14159 / 180) * cos(lat2 * 3.14159 / 180) * 
                         sin(dLon/2) * sin(dLon/2))
                    c = 2 * atan2(sqrt(a), sqrt(1-a))
                    distance = R * c
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

# ================================================================================
# API ROUTES
# ================================================================================

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

@app.route('/api/submit_beer_update', methods=['POST'])
def submit_beer_update():
    """Submit beer report - updated for new schema with brewery checking"""
    try:
        data = request.get_json()
        logger.info(f"Received beer report data: {data}")
        
        # Get user info
        submitted_by = data.get('submitted_by', 'anonymous')
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
        
        # STEP 1: Check if brewery exists, if not add it
        cursor.execute("""
            SELECT brewery_id FROM breweries 
            WHERE LOWER(brewery_name) = LOWER(%s)
        """, (brewery_name,))
        
        brewery_row = cursor.fetchone()
        
        if brewery_row:
            brewery_id = brewery_row['brewery_id']
            logger.info(f"Found existing brewery: {brewery_name} (ID: {brewery_id})")
        else:
            # Add new brewery
            cursor.execute("SELECT MAX(brewery_id) as max_id FROM breweries")
            max_brewery_id = cursor.fetchone()['max_id'] or 0
            brewery_id = max_brewery_id + 1
            
            cursor.execute("""
                INSERT INTO breweries (brewery_id, brewery_name, created_by)
                VALUES (%s, %s, %s)
            """, (brewery_id, brewery_name, submitted_by))
            
            logger.info(f"Added new brewery: {brewery_name} (ID: {brewery_id}) by {submitted_by}")
        
        # STEP 2: Check if beer exists, if not add it
        cursor.execute("""
            SELECT beer_id FROM beers 
            WHERE brewery_id = %s AND LOWER(beer_name) = LOWER(%s)
        """, (brewery_id, beer_name))
        
        beer_row = cursor.fetchone()
        
        if beer_row:
            beer_id = beer_row['beer_id']
            logger.info(f"Found existing beer: {beer_name} (ID: {beer_id})")
        else:
            # Add new beer
            cursor.execute("SELECT MAX(beer_id) as max_id FROM beers")
            max_beer_id = cursor.fetchone()['max_id'] or 0
            beer_id = max_beer_id + 1
            
            # Parse ABV
            abv_value = None
            if beer_abv:
                try:
                    abv_value = float(beer_abv)
                except (ValueError, TypeError):
                    abv_value = None
            
            cursor.execute("""
                INSERT INTO beers (brewery_id, beer_id, beer_name, style, abv, gluten_status, created_by)
                VALUES (%s, %s, %s, %s, %s, 'gluten_removed', %s)
            """, (brewery_id, beer_id, beer_name, beer_style, abv_value, submitted_by))
            
            logger.info(f"Added new beer: {brewery_name} - {beer_name} (ID: {beer_id}) by {submitted_by}")
        
        # STEP 3: Check if this beer is already reported for this venue
        cursor.execute("""
            SELECT report_id FROM venue_beers 
            WHERE venue_id = %s AND beer_id = %s AND format = %s
        """, (venue_id, beer_id, format_type))
        
        existing_report = cursor.fetchone()
        
        if existing_report:
            # Update existing report
            cursor.execute("""
                UPDATE venue_beers 
                SET last_seen = CURRENT_DATE, 
                    times_reported = times_reported + 1,
                    last_updated_by = %s
                WHERE report_id = %s
            """, (submitted_by, existing_report['report_id']))
            report_id = existing_report['report_id']
            logger.info(f"Updated existing report {report_id} by {submitted_by}")
        else:
            # Insert new report
            cursor.execute("""
                INSERT INTO venue_beers (
                    venue_id, beer_id, format, added_by
                ) VALUES (
                    %s, %s, %s, %s
                )
            """, (venue_id, beer_id, format_type, submitted_by))
            report_id = cursor.lastrowid
            logger.info(f"Added new venue_beer report {report_id} by {submitted_by}")
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '🎉 Beer report added successfully!',
            'report_id': report_id,
            'beer_id': beer_id,
            'brewery_id': brewery_id,
            'status': 'approved'
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
    """Update GF status using new schema"""
    try:
        data = request.get_json()
        venue_id = data.get('venue_id')
        new_status = data.get('status')
        submitted_by = data.get('submitted_by', 'anonymous')
        
        if not venue_id or not new_status:
            return jsonify({'error': 'Missing venue_id or status'}), 400
            
        valid_statuses = ['always_tap_cask', 'always_bottle_can', 'currently', 'not_currently', 'unknown']
        
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get current status for audit trail
        cursor.execute("SELECT status FROM gf_status WHERE venue_id = %s", (venue_id,))
        current_row = cursor.fetchone()
        old_status = current_row['status'] if current_row else 'unknown'
        
        # Insert into status_updates table for audit trail
        cursor.execute("""
            INSERT INTO status_updates (venue_id, old_status, new_status, updated_by)
            VALUES (%s, %s, %s, %s)
        """, (venue_id, old_status, new_status, submitted_by))
        
        # Update the GF status
        cursor.execute("""
            UPDATE gf_status 
            SET status = %s, updated_at = NOW(), updated_by = %s
            WHERE venue_id = %s
        """, (new_status, submitted_by, venue_id))
        
        # If no rows updated, insert new record
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO gf_status (venue_id, status, updated_at, updated_by)
                VALUES (%s, %s, NOW(), %s)
            """, (venue_id, new_status, submitted_by))
        
        conn.commit()
        
        logger.info(f"Updated venue {venue_id} GF status from {old_status} to {new_status} by {submitted_by}")
        
        return jsonify({
            'success': True,
            'message': f'Status updated to {new_status}',
            'status': new_status
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
    try:
        data = request.get_json()
        
        # Log incoming data for debugging
        logger.info(f"Add venue request: {data}")
        
        # Validate required fields
        required_fields = ['venue_name', 'address', 'postcode']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
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
                'venue_id': existing[0]
            }), 409
        
        # Get the submitted_by value (nickname or 'anonymous')
        submitted_by = data.get('submitted_by', 'anonymous')
        
        # Parse the address to extract components
        address_parts = data['address'].split(',')
        street = address_parts[0].strip() if len(address_parts) > 0 else ''
        city = address_parts[-1].strip() if len(address_parts) > 1 else ''
        
        # Determine venue_type from Google Places data or default to 'pub'
        venue_type = 'pub'  # Default fallback
        
        # Try to map from source data if available
        if 'types' in data and data['types']:
            # Map Google Places types to our ENUM values
            google_types = data['types']
            if 'bar' in google_types:
                venue_type = 'bar'
            elif 'restaurant' in google_types:
                venue_type = 'restaurant' 
            elif 'lodging' in google_types:
                venue_type = 'hotel'
            elif 'night_club' in google_types:
                venue_type = 'club'
            # Keep 'pub' as default for everything else
        
        # Insert new venue with correct ENUM value
        cursor.execute("""
            INSERT INTO venues (
                venue_name, street, city, postcode, 
                address, latitude, longitude, 
                venue_type, created_by
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
            venue_type,  # Use the determined enum value
            submitted_by
        ))
        
        venue_id = cursor.lastrowid
        
        # Add initial GF status as unknown
        cursor.execute("""
            INSERT INTO gf_status (venue_id, status, updated_at, updated_by)
            VALUES (%s, 'unknown', NOW(), %s)
        """, (venue_id, submitted_by))
        
        conn.commit()
        
        # Log the addition
        logger.info(f"New venue added: {data['venue_name']} (ID: {venue_id}) as {venue_type} by {submitted_by}")
        
        return jsonify({
            'success': True,
            'message': f'{data["venue_name"]} added successfully!',
            'venue_id': venue_id,
            'venue_type': venue_type
        })
        
    except mysql.connector.IntegrityError as e:
        logger.error(f"Database integrity error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'This venue may already exist in our database'
        }), 409
        
    except mysql.connector.Error as e:
        logger.error(f"MySQL error in add_venue: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}'
        }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in add_venue: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to add venue. Please try again.'
        }), 500
        
    finally:
        if 'conn' in locals() and conn.is_connected():
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


