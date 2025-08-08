# ================================================================================
# COELIACS LIKE BEER TOO - UPDATED APP.PY FOR NEW SCHEMA
# ================================================================================

from flask import Flask, request, jsonify, render_template
import mysql.connector
import os
from dotenv import load_dotenv
import logging
import time
import json
from datetime import datetime, timedelta

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
        
        # Build search condition
        if search_type == 'name':
            search_condition = "p.name LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'postcode':
            search_condition = "p.postcode LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'area':
            search_condition = "p.local_authority LIKE %s"
            params = (f'%{query}%',)
        else:
            search_condition = "(p.name LIKE %s OR p.postcode LIKE %s OR p.local_authority LIKE %s OR p.address LIKE %s)"
            params = (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%')
        
        # Updated query for new schema
        sql = f"""
            SELECT p.pub_id, p.name, p.address, p.postcode
            FROM pubs p
            LEFT JOIN pub_gf_status s ON p.pub_id = s.pub_id
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND s.status IN ('always', 'currently')"
        
        sql += " ORDER BY p.name LIMIT 100"
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        return jsonify(pubs)
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in autocomplete: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/nearby')
def nearby():
    """Find nearby pubs with new schema"""
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
                p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                p.latitude, p.longitude,
                COALESCE(s.status, 'unknown') as gf_status,
                (6371 * acos(cos(radians(%s)) * cos(radians(p.latitude)) * 
                cos(radians(p.longitude) - radians(%s)) + sin(radians(%s)) * 
                sin(radians(p.latitude)))) AS distance,
                GROUP_CONCAT(
                            DISTINCT CONCAT(sub.format, ' - ', 
                            COALESCE(sub.brewery, 'Unknown'), ' ', 
                            COALESCE(sub.beer_name, 'Unknown'), ' (', 
                            COALESCE(sub.beer_style, 'Unknown'), ')')
                            SEPARATOR ', '
                        ) as beer_details
            FROM pubs p
            LEFT JOIN pub_gf_status s ON p.pub_id = s.pub_id
            LEFT JOIN submissions sub ON p.pub_id = sub.pub_id 
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        """
        params = [lat, lng, lat]
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += """
            GROUP BY p.pub_id
            HAVING distance <= %s
            ORDER BY distance
            LIMIT 50
        """
        params.append(radius)
        
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        return jsonify(pubs)
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in nearby search: {str(e)}")
        return jsonify({'error': 'Database error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/search')
def search():
    """Main search functionality with new schema"""
    query = request.args.get('query', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    pub_id = request.args.get('pub_id', type=int)
    
    if query and (len(query) < 1 or len(query) > 100):
        return jsonify({'error': 'Invalid query length'}), 400
    
    if page < 1 or page > 1000:
        return jsonify({'error': 'Invalid page number'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Handle specific pub ID search
        if pub_id:
            sql = """
                SELECT DISTINCT
                    p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                    p.latitude, p.longitude,
                    COALESCE(s.status, 'unknown') as gf_status,
                    GROUP_CONCAT(
                            DISTINCT CONCAT(sub.format, ' - ', 
                            COALESCE(sub.brewery, 'Unknown'), ' ', 
                            COALESCE(sub.beer_name, 'Unknown'), ' (', 
                            COALESCE(sub.beer_style, 'Unknown'), ')')
                            SEPARATOR ', '
                        ) as beer_details
                FROM pubs p
                LEFT JOIN pub_gf_status s ON p.pub_id = s.pub_id
                LEFT JOIN submissions sub ON p.pub_id = sub.pub_id 
                WHERE p.pub_id = %s
                GROUP BY p.pub_id
            """
            cursor.execute(sql, (pub_id,))
            pubs = cursor.fetchall()
            return jsonify(pubs)
        
        # Regular search logic
        if not query:
            return jsonify({'error': 'Query is required for search'}), 400
        
        # Build search condition
        if search_type == 'name':
            search_condition = "p.name LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'postcode':
            search_condition = "p.postcode LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'area':
            search_condition = "p.local_authority LIKE %s"
            params = [f'%{query}%']
        else:
            search_condition = "(p.name LIKE %s OR p.postcode LIKE %s OR p.local_authority LIKE %s OR p.address LIKE %s)"
            params = [f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%']
        
        # Count total results
        count_sql = f"""
            SELECT COUNT(DISTINCT p.pub_id) as total
            FROM pubs p
            LEFT JOIN pub_gf_status s ON p.pub_id = s.pub_id
            WHERE {search_condition}
        """
        
        if gf_only:
            count_sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        cursor.execute(count_sql, params)
        total_results = cursor.fetchone()['total']
        
        # Calculate pagination
        per_page = 20
        total_pages = (total_results + per_page - 1) // per_page
        offset = (page - 1) * per_page
        
        # Main search query - FIXED
        sql = f"""
            SELECT DISTINCT
                p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                p.latitude, p.longitude,
                COALESCE(s.status, 'unknown') as gf_status,
                GROUP_CONCAT(
                        DISTINCT CONCAT(sub.format, ' - ', 
                        COALESCE(sub.brewery, 'Unknown'), ' ', 
                        COALESCE(sub.beer_name, 'Unknown'), ' (', 
                        COALESCE(sub.beer_style, 'Unknown'), ')')
                        SEPARATOR ', '
                        ) as beer_details
            FROM pubs p
            LEFT JOIN pub_gf_status s ON p.pub_id = s.pub_id
            LEFT JOIN submissions sub ON p.pub_id = sub.pub_id 
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += """
            GROUP BY p.pub_id
            ORDER BY p.name
            LIMIT %s OFFSET %s
        """
        
        params.extend([per_page, offset])
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        return jsonify({
            'pubs': pubs,
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

# ================================================================================
# API ROUTES
# ================================================================================

@app.route('/api/stats')
def get_stats():
    """Get site statistics with new schema"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Total pubs
        cursor.execute("SELECT COUNT(*) as total FROM pubs")
        total_pubs = cursor.fetchone()[0]
        
        # Pubs with GF options
        cursor.execute("""
            SELECT COUNT(DISTINCT pub_id) as gf_total 
            FROM pub_gf_status 
            WHERE status IN ('always_tap_cask','always_bottle_can', 'currently')
        """)
        gf_pubs = cursor.fetchone()[0]

        # Pubs with GF options this month
        cursor.execute("""
            SELECT COUNT(DISTINCT pub_id) as gf_total_this_month
            FROM pub_gf_status 
            WHERE status IN ('always_tap_cask','always_bottle_can', 'currently')
            AND YEAR(updated_at) = YEAR(CURRENT_DATE())
            AND MONTH(updated_at) = MONTH(CURRENT_DATE())
        """)
        gf_pubs_this_month = cursor.fetchone()[0]
        
        return jsonify({
            'total_pubs': total_pubs,
            'gf_pubs': gf_pubs,
            'gf_pubs_this_month': gf_pubs_this_month
        })
        
    except Exception as e:
        logger.error(f"Error in stats: {str(e)}")
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249,
            'gf_pubs_this_month': 10 
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
                SELECT DISTINCT brewery 
                FROM beers 
                WHERE brewery LIKE %s
                ORDER BY brewery
                LIMIT 20
            """, (f'%{query}%',))
        else:
            cursor.execute("""
                SELECT DISTINCT brewery 
                FROM beers 
                ORDER BY brewery
                LIMIT 50
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
                SELECT beer_id, name, style, abv, gluten_status, vegan_status
                FROM beers 
                WHERE brewery = %s AND name LIKE %s
                ORDER BY name
                LIMIT 20
            """, (brewery_name, f'%{query}%'))
        else:
            cursor.execute("""
                SELECT beer_id, name, style, abv, gluten_status, vegan_status
                FROM beers 
                WHERE brewery = %s 
                ORDER BY name
                LIMIT 50
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
    """Submit beer report - simplified, no validation tiers"""
    try:
        data = request.get_json()
        
        # Get user info
        user_info = {
            'ip': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'submitted_by': data.get('submitted_by', 'anonymous')
        }
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # STEP 1: Check if beer exists, if not add it
        beer_id = None
        brewery = data.get('brewery')
        beer_name = data.get('beer_name')
        
        if brewery and beer_name:
            cursor.execute("""
                SELECT beer_id FROM beers 
                WHERE LOWER(brewery) = LOWER(%s) AND LOWER(name) = LOWER(%s)
            """, (brewery, beer_name))
            
            existing_beer = cursor.fetchone()
            
            if existing_beer:
                beer_id = existing_beer['beer_id']
            else:
                # Add new beer
                cursor.execute("""
                    INSERT INTO beers (brewery, name, style, abv, gluten_status)
                    VALUES (%s, %s, %s, %s, 'certified_gf')
                """, (
                    brewery,
                    beer_name,
                    data.get('beer_style'),
                    data.get('beer_abv')
                ))
                beer_id = cursor.lastrowid
                logger.info(f"Added new beer: {brewery} - {beer_name} (ID: {beer_id})")
        
        # STEP 2: Insert submission - AUTO-APPROVED!
        cursor.execute("""
            INSERT INTO submissions (
                pub_id, beer_id, brewery, beer_name, beer_style, beer_abv, 
                format, submitted_at, submitted_by, status, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, NOW(), %s, 'approved', %s
            )
        """, (
            data.get('pub_id'),
            beer_id,
            brewery,
            beer_name,
            data.get('beer_style'),
            data.get('beer_abv'),
            data.get('beer_format'),
            user_info['submitted_by'],
            data.get('notes', '')
        ))
        
        submission_id = cursor.lastrowid
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '🎉 Beer report added successfully!',
            'submission_id': submission_id,
            'beer_id': beer_id,
            'status': 'approved'  # Always approved now!
        })
        
    except Exception as e:
        logger.error(f"Error in submit_beer_update: {str(e)}")
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
    """Update GF status using stored procedure"""
    try:
        data = request.get_json()
        pub_id = data.get('pub_id')
        status = data.get('status')
        
        if not pub_id or not status:
            return jsonify({'error': 'Missing pub_id or status'}), 400
            
        # Updated to include new 5-tier statuses
        valid_statuses = ['always_tap_cask', 'always_bottle_can', 'currently', 'not_currently', 'unknown']
        
        if status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
       # Update the GF status directly
        cursor.execute("""
            UPDATE pub_gf_status 
            SET status = %s,
                updated_at = NOW(),
                updated_by = 'user'
            WHERE pub_id = %s
        """, (status, pub_id))
        
        # If no rows updated, insert new record
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO pub_gf_status (pub_id, status, updated_at, updated_by)
                VALUES (%s, %s, NOW(), 'user')
            """, (pub_id, status))
        
        conn.commit()
        
        logger.info(f"Updated pub {pub_id} GF status to {status}")
        
        return jsonify({
            'success': True,
            'message': f'Status updated to {status}',
            'status': status
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

@app.route('/api/all-pubs')
def get_all_pubs_for_map():
    """Get all pubs with coordinates for map display"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Updated query for new schema
        cursor.execute("""
            SELECT 
                p.pub_id, p.name, p.address, p.postcode, p.local_authority,
                p.latitude, p.longitude,
                COALESCE(s.status, 'unknown') as gf_status
            FROM pubs p
            LEFT JOIN pub_gf_status s ON p.pub_id = s.pub_id
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL 
            AND p.latitude != 0 AND p.longitude != 0            
            ORDER BY s.status ASC
            LIMIT 1000
        """)
        
        pubs = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'pubs': pubs,
            'total': len(pubs)
        })
        
    except Exception as e:
        logger.error(f"Error fetching all pubs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to load pubs'
        }), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/breweries')
def api_breweries():
    """Get unique brewery names from beers data"""
    try:
        # Query unique breweries from your beers data
        result = supabase.table('beers')\
            .select('brewery')\
            .execute()
        
        # Extract unique brewery names
        breweries = list(set(beer['brewery'] for beer in result.data if beer.get('brewery')))
        breweries.sort()
        
        return jsonify(breweries)
    except Exception as e:
        logger.error(f"Error fetching breweries: {e}")
        return jsonify([]), 500

@app.route('/api/add-pub', methods=['POST'])
def add_pub():
    """Add a new pub to the database"""
    try:
        data = request.get_json()
        
        # Log incoming data for debugging
        logger.info(f"Add pub request: {data}")
        
        # Validate required fields
        required_fields = ['name', 'address', 'postcode']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Check if pub already exists
        cursor.execute("""
            SELECT pub_id FROM pubs 
            WHERE LOWER(name) = LOWER(%s) AND postcode = %s
        """, (data['name'], data['postcode']))
        
        existing = cursor.fetchone()
        if existing:
            return jsonify({
                'success': False,
                'error': 'A pub with this name and postcode already exists',
                'pub_id': existing[0]
            }), 409
        
        # Get the submitted_by value (nickname or 'anonymous')
        submitted_by = data.get('submitted_by', 'anonymous')
        
        # Insert new pub with created_by field
        cursor.execute("""
            INSERT INTO pubs (
                name, address, postcode, 
                latitude, longitude, 
                local_authority, created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            data['name'],
            data['address'],
            data['postcode'],
            data.get('latitude'),
            data.get('longitude'),
            data.get('local_authority', ''),
            submitted_by
        ))
        
        pub_id = cursor.lastrowid
        
        # Add initial GF status as unknown
        cursor.execute("""
            INSERT INTO pub_gf_status (pub_id, status, updated_at, updated_by)
            VALUES (%s, 'unknown', NOW(), %s)
        """, (pub_id, submitted_by))
        
        conn.commit()
        
        # Log the addition
        logger.info(f"New pub added: {data['name']} (ID: {pub_id}) by {submitted_by}")
        
        return jsonify({
            'success': True,
            'message': f'{data["name"]} added successfully!',
            'pub_id': pub_id,
            'name': data['name']
        })
        
    except mysql.connector.IntegrityError as e:
        logger.error(f"Database integrity error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'This pub may already exist in our database'
        }), 409
        
    except mysql.connector.Error as e:
        logger.error(f"MySQL error in add_pub: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}'
        }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in add_pub: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to add pub. Please try again.'
        }), 500
        
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
        
        # Total submissions
        cursor.execute("SELECT COUNT(*) as count FROM submissions")
        total_submissions = cursor.fetchone()['count']
        
        # Today's submissions
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM submissions
            WHERE DATE(submitted_at) = CURDATE()
        """)
        today_submissions = cursor.fetchone()['count']
        
        # Total beers
        cursor.execute("SELECT COUNT(*) as count FROM beers")
        total_beers = cursor.fetchone()['count']
        
        return jsonify({
            'total_submissions': total_submissions,
            'today_submissions': today_submissions,
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
@app.route('/pub')
@app.route('/map')
@app.route('/breweries')
def spa_routes():
    """Handle client-side routing - always return index"""
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





