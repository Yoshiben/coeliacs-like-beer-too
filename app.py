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
        
        # Build search condition for new schema
        if search_type == 'name':
            search_condition = "v.name LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'postcode':
            search_condition = "v.postcode LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'area':
            search_condition = "v.city LIKE %s"  # Changed from local_authority to city
            params = (f'%{query}%',)
        else:
            search_condition = "(v.name LIKE %s OR v.postcode LIKE %s OR v.city LIKE %s OR v.address LIKE %s)"
            params = (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%')
        
        # Updated query for new schema
        sql = f"""
            SELECT v.venue_id, v.name, 
                   CONCAT_WS(', ', v.housenumber, v.street, v.city) as address, 
                   v.postcode
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += " ORDER BY v.name LIMIT 100"
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
                ,v.venue_name, 
                ,v.address
                ,v.postcode
                ,v.city
                ,v.latitude
                ,v.longitude
                ,COALESCE(s.status, 'unknown') as gf_status,
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
            LIMIT 50
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
    """Main search functionality with new schema"""
    query = request.args.get('query', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    venue_id = request.args.get('venue_id', type=int)  # Changed from venue_id
    
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
                    v.venue_id, v.name, 
                    v.address, 
                    v.postcode, v.city as local_authority,
                    v.latitude, v.longitude,
                    COALESCE(s.status, 'unknown') as gf_status,
                    GROUP_CONCAT(
                        DISTINCT CONCAT(vb.format, ' - ', 
                        COALESCE(br.name, 'Unknown'), ' ', 
                        COALESCE(b.name, 'Unknown'), ' (', 
                        COALESCE(b.style, 'Unknown'), ')')
                        SEPARATOR ', '
                    ) as beer_details
                FROM venues v
                LEFT JOIN gf_status s ON v.venue_id = s.venue_id
                LEFT JOIN venue_beers vb ON v.venue_id = vb.venue_id
                LEFT JOIN beers b ON vb.beer_id = b.beer_id
                LEFT JOIN breweries br ON b.brewery_id = br.brewery_id
                WHERE v.venue_id = %s
                GROUP BY v.venue_id
            """
            cursor.execute(sql, (venue_id,))
            venues = cursor.fetchall()
            return jsonify(venues)
        
        # Regular search logic
        if not query:
            return jsonify({'error': 'Query is required for search'}), 400
        
        # Build search condition
        if search_type == 'name':
            search_condition = "v.name LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'postcode':
            search_condition = "v.postcode LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'area':
            search_condition = "v.city LIKE %s"  # Changed from local_authority
            params = [f'%{query}%']
        else:
            search_condition = "(v.name LIKE %s OR v.postcode LIKE %s OR v.city LIKE %s OR v.address LIKE %s)"
            params = [f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%']
        
        # Count total results
        count_sql = f"""
            SELECT COUNT(DISTINCT v.venue_id) as total
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
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
        
        # Main search query
        sql = f"""
            SELECT DISTINCT
                v.venue_id, v.name, 
                CONCAT_WS(', ', v.housenumber, v.street, v.city) as address, 
                v.postcode, v.city as local_authority,
                v.latitude, v.longitude,
                COALESCE(s.status, 'unknown') as gf_status,
                GROUP_CONCAT(
                    DISTINCT CONCAT(vb.format, ' - ', 
                    COALESCE(b.brewery, 'Unknown'), ' ', 
                    COALESCE(b.name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM venues v
            LEFT JOIN gf_status s ON v.venue_id = s.venue_id
            LEFT JOIN venue_beers vb ON v.venue_id = vb.venue_id
            LEFT JOIN beers b ON vb.beer_id = b.beer_id
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND s.status IN ('always_tap_cask', 'always_bottle_can', 'currently')"
        
        sql += """
            GROUP BY v.venue_id
            ORDER BY v.name
            LIMIT %s OFFSET %s
        """
        
        params.extend([per_page, offset])
        cursor.execute(sql, params)
        venues = cursor.fetchall()
        
        # Map results to use venue_id for backwards compatibility
        for venue in venues:
            venue['venue_id'] = venue['venue_id']
        
        return jsonify({
            'venues': venues,  # Keep as 'venues' for frontend compatibility
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
            'total_venues': total_venues,  # Keep as total_venues for frontend
            'gf_venues': gf_venues,
            'gf_venues_this_month': gf_venues_this_month
        })
        
    except Exception as e:
        logger.error(f"Error in stats: {str(e)}")
        return jsonify({
            'total_venues': 49841,
            'gf_venues': 1249,
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
    """Submit beer report - updated for new schema"""
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
        brewery_name = data.get('brewery_name')
        beer_name = data.get('beer_name')
        
        if brewery_name and beer_name:
            cursor.execute("""
                SELECT beer_id 
                FROM beers b
                LEFT JOIN breweries br
                ON b.brewery_id = br.brewery_id
                WHERE LOWER(brewery_name) = LOWER(%s) AND LOWER(beer_name) = LOWER(%s)
            """, (brewery_name, beer_name))
            
            existing_beer = cursor.fetchone()
            
            if existing_beer:
                beer_id = existing_beer['beer_id']
            else:
                # Add new beer - need to generate next ID
                cursor.execute("SELECT MAX(beer_id) as max_id FROM beers")
                max_id = cursor.fetchone()['max_id'] or 0
                beer_id = max_id + 1
                
                cursor.execute("""
                    INSERT INTO beers (beer_id, brewery, name, style, abv, gluten_status)
                    VALUES (%s, %s, %s, %s, %s, 'gluten_removed')
                """, (
                    beer_id,
                    brewery,
                    beer_name,
                    data.get('beer_style'),
                    data.get('beer_abv')
                ))
                logger.info(f"Added new beer: {brewery} - {beer_name} (ID: {beer_id})")
        
        beer_abv = data.get('beer_abv')
        if beer_abv:
            try:
                beer_abv = float(beer_abv)
            except (ValueError, TypeError):
                beer_abv = None
        
        # STEP 2: Insert into venue_beers - AUTO-APPROVED!
        venue_id = data.get('venue_id')  # Frontend still sends venue_id
        format_type = data.get('format') or data.get('beer_format')
        
        # Check if this beer is already reported for this venue
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
                    times_reported = times_reported + 1
                WHERE report_id = %s
            """, (existing_report['report_id'],))
            report_id = existing_report['report_id']
        else:
            # Insert new report
            cursor.execute("""
                INSERT INTO venue_beers (
                    venue_id, beer_id, format, added_by
                ) VALUES (
                    %s, %s, %s, %s
                )
            """, (venue_id, beer_id, format_type, user_info['submitted_by']))
            report_id = cursor.lastrowid
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '🎉 Beer report added successfully!',
            'report_id': report_id,
            'beer_id': beer_id,
            'status': 'approved'
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
    """Update GF status using new schema"""
    try:
        data = request.get_json()
        venue_id = data.get('venue_id')  # Frontend still sends venue_id
        status = data.get('status')
        
        if not venue_id or not status:
            return jsonify({'error': 'Missing venue_id or status'}), 400
            
        # Updated to include new 5-tier statuses
        valid_statuses = ['always_tap_cask', 'always_bottle_can', 'currently', 'not_currently', 'unknown']
        
        if status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Update the GF status directly
        cursor.execute("""
            UPDATE gf_status 
            SET status = %s,
                updated_at = NOW(),
                updated_by = 'user'
            WHERE venue_id = %s
        """, (status, venue_id))
        
        # If no rows updated, insert new record
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO gf_status (venue_id, status, updated_at, updated_by)
                VALUES (%s, %s, NOW(), 'user')
            """, (venue_id, status))
        
        conn.commit()
        
        logger.info(f"Updated venue {venue_id} GF status to {status}")
        
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

@app.route('/api/all-venues')
def get_all_venues_for_map():
    """Get all venues with coordinates for map display"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Updated query for new schema
        cursor.execute("""
            SELECT 
                v.venue_id as venue_id, v.name, 
                CONCAT_WS(', ', v.housenumber, v.street, v.city) as address, 
                v.postcode, v.city as local_authority,
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
            'venues': venues,  # Keep as 'venues' for frontend
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
        required_fields = ['name', 'address', 'postcode']
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
            WHERE LOWER(name) = LOWER(%s) AND postcode = %s
        """, (data['name'], data['postcode']))
        
        existing = cursor.fetchone()
        if existing:
            return jsonify({
                'success': False,
                'error': 'A venue with this name and postcode already exists',
                'venue_id': existing[0]  # Return as venue_id for frontend
            }), 409
        
        # Get the submitted_by value (nickname or 'anonymous')
        submitted_by = data.get('submitted_by', 'anonymous')
        
        # Parse the address to extract components
        address_parts = data['address'].split(',')
        street = address_parts[0].strip() if len(address_parts) > 0 else ''
        city = address_parts[-1].strip() if len(address_parts) > 1 else ''
        
        # Insert new venue
        cursor.execute("""
            INSERT INTO venues (
                name, street, city, postcode, 
                address, latitude, longitude, 
                venue_type, created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, 'venue', %s
            )
        """, (
            data['name'],
            street,
            city,
            data['postcode'],
            data['address'],
            data.get('latitude'),
            data.get('longitude'),
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
        logger.info(f"New venue added: {data['name']} (ID: {venue_id}) by {submitted_by}")
        
        return jsonify({
            'success': True,
            'message': f'{data["name"]} added successfully!',
            'venue_id': venue_id,  # Return as venue_id for frontend
            'name': data['name']
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





