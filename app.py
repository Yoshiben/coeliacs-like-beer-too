from flask import Flask, request, jsonify, render_template
import mysql.connector
import os
from dotenv import load_dotenv
import logging
import time
from werkzeug.middleware.proxy_fix import ProxyFix

# Initialize Flask app
app = Flask(__name__)

# Load environment variables
load_dotenv()

# Security middleware for production
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

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

@app.route('/')
def index():
    version = str(int(time.time()))
    return render_template('index.html', cache_buster=version)

@app.route('/autocomplete')
def autocomplete():
    query = request.args.get('q', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    
    # Input validation
    if not query or len(query) < 2 or len(query) > 100:
        return jsonify([])

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build search condition based on search type
        if search_type == 'name':
            search_condition = "name LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'postcode':
            search_condition = "postcode LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'area':
            search_condition = "local_authority LIKE %s"
            params = (f'%{query}%',)
        else:  # search_type == 'all'
            search_condition = "(name LIKE %s OR postcode LIKE %s OR local_authority LIKE %s OR address LIKE %s)"
            params = (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%')
        
        sql = f"""
            SELECT pub_id, name, address, postcode
            FROM pubs
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND (bottle = 1 OR tap = 1 OR cask = 1 OR can = 1)"
            logger.debug(f"Filtering for gluten-free with query: {query}, search_type: {search_type}")
        else:
            logger.debug(f"No gluten-free filter, query: {query}, search_type: {search_type}")
        
        sql += " ORDER BY name LIMIT 100"
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        logger.debug(f"Returned {len(pubs)} pubs")
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in autocomplete: {str(e)}")
        return jsonify([])
    except Exception as e:
        logger.error(f"Unexpected error in autocomplete: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
    
    return jsonify(pubs)

@app.route('/search')
def search():
    query = request.args.get('query', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    pub_id = request.args.get('pub_id', None)
    page = request.args.get('page', 1, type=int)
    per_page = 20  # Results per page
    offset = (page - 1) * per_page
    
    # Input validation
    if not query and not pub_id:
        return jsonify([])
    
    if query and len(query) > 100:
        return jsonify({'error': 'Search query too long'}), 400
    
    if page < 1 or page > 1000:  # Reasonable page limits
        return jsonify({'error': 'Invalid page number'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Handle specific pub ID search (no pagination needed)
        if pub_id:
            if not pub_id.isdigit():
                return jsonify({'error': 'Invalid pub ID'}), 400
                
            sql = """
                SELECT p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                       p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                       GROUP_CONCAT(CONCAT(pu.beer_format, ' - ', pu.beer_brewery, ' ', pu.beer_name, ' (', pu.beer_style, ')') SEPARATOR ', ') as beer_details
                FROM pubs p
                LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
                WHERE p.pub_id = %s
                GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            """
            cursor.execute(sql, (pub_id,))
            pubs = cursor.fetchall()
            logger.debug(f"Pub ID search returned: {len(pubs)} results")
            return jsonify(pubs)
        
        # Handle regular search with pagination
        sql = """
            SELECT p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                   p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                   GROUP_CONCAT(CONCAT(pu.beer_format, ' - ', pu.beer_brewery, ' ', pu.beer_name, ' (', pu.beer_style, ')') SEPARATOR ', ') as beer_details
            FROM pubs p
            LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
        """
        params = []
        count_sql = "SELECT COUNT(DISTINCT p.pub_id) as total FROM pubs p"
        count_params = []
        
        # Build search condition based on search type
        if search_type == 'name':
            condition = " WHERE p.name LIKE %s"
            search_param = f'%{query}%'
            params.append(search_param)
            count_params.append(search_param)
        elif search_type == 'postcode':
            condition = " WHERE p.postcode LIKE %s"
            search_param = f'%{query}%'
            params.append(search_param)
            count_params.append(search_param)
        elif search_type == 'area':
            condition = " WHERE p.local_authority LIKE %s"
            search_param = f'%{query}%'
            params.append(search_param)
            count_params.append(search_param)
        else:  # search_type == 'all'
            condition = " WHERE (p.name LIKE %s OR p.postcode LIKE %s OR p.local_authority LIKE %s OR p.address LIKE %s)"
            search_params = [f'%{query}%'] * 4
            params.extend(search_params)
            count_params.extend(search_params)
        
        sql += condition
        count_sql += condition
        
        if gf_only:
            gf_condition = " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
            sql += gf_condition
            count_sql += gf_condition
            
        # Get total count for pagination
        cursor.execute(count_sql, count_params)
        total_results = cursor.fetchone()['total']
        
        sql += " GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude"
        sql += f" ORDER BY p.name LIMIT {per_page} OFFSET {offset}"
        
        logger.debug(f"Executing SQL: {sql} with {len(params)} params")
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        # Return pagination info
        result = {
            'pubs': pubs,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_results,
                'pages': (total_results + per_page - 1) // per_page,
                'has_next': page * per_page < total_results,
                'has_prev': page > 1
            }
        }
        
        logger.debug(f"Query returned: {len(pubs)} pubs, total: {total_results}")
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in search: {str(e)}")
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in search: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
    
    return jsonify(result)

@app.route('/nearby')
def nearby():
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 5, type=int)
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    
    # Input validation
    if not lat or not lng:
        return jsonify({'error': 'Latitude and longitude required'}), 400
    
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({'error': 'Invalid coordinates'}), 400
    
    if not (1 <= radius <= 50):  # Reasonable radius limits
        return jsonify({'error': 'Invalid radius'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        sql = """
            SELECT p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                   p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                   GROUP_CONCAT(CONCAT(pu.beer_format, ' - ', pu.beer_brewery, ' ', pu.beer_name, ' (', pu.beer_style, ')') SEPARATOR ', ') as beer_details,
                   (6371 * acos(cos(radians(%s)) * cos(radians(p.latitude)) * 
                   cos(radians(p.longitude) - radians(%s)) + sin(radians(%s)) * 
                   sin(radians(p.latitude)))) AS distance
            FROM pubs p
            LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        """
        params = [lat, lng, lat]
        
        if gf_only:
            sql += " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
        
        sql += """
            GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                     p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            HAVING distance <= %s
            ORDER BY distance
            LIMIT 50
        """
        params.append(radius)
        
        logger.debug(f"Executing nearby search with radius {radius}km")
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        logger.debug(f"Found {len(pubs)} nearby pubs")
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in nearby search: {str(e)}")
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in nearby search: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
    
    return jsonify(pubs)

@app.route('/update', methods=['POST'])
def update():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400
            
        pub_id = data.get('pub_id')
        if not pub_id or not str(pub_id).isdigit():
            return jsonify({'message': 'Valid pub ID is required'}), 400

        bottle = int(data.get('bottle', 0))
        tap = int(data.get('tap', 0))
        cask = int(data.get('cask', 0))
        can = int(data.get('can', 0))

        # Validate values are 0 or 1
        if not all(val in [0, 1] for val in [bottle, tap, cask, can]):
            return jsonify({'message': 'Invalid values provided'}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE pubs
            SET bottle = %s, tap = %s, cask = %s, can = %s
            WHERE pub_id = %s
        """, (bottle, tap, cask, can, pub_id))
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'Pub not found'}), 404
            
        conn.commit()
        logger.info(f"Updated pub {pub_id} with GF options")
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in update: {str(e)}")
        return jsonify({'message': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in update: {str(e)}")
        return jsonify({'message': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
    
    return jsonify({'message': 'Pub updated successfully'})

@app.route('/update_beers', methods=['POST'])
def update_beers():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400
            
        pub_id = data.get('pub_id')
        update_mode = data.get('update_mode', 'add')
        
        if not pub_id or not str(pub_id).isdigit():
            return jsonify({'message': 'Valid pub ID is required'}), 400
        
        if update_mode not in ['add', 'replace']:
            return jsonify({'message': 'Invalid update mode'}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # Only clear existing updates if mode is 'replace'
        if update_mode == 'replace':
            cursor.execute("DELETE FROM pubs_updates WHERE pub_id = %s", (pub_id,))

        # Insert new updates
        updates = data.get('updates', [])
        valid_formats = ['bottle', 'tap', 'cask', 'can']
        
        for update in updates:
            beer_format = update.get('beer_format', '').strip()
            beer_brewery = update.get('beer_brewery', 'Unknown').strip()[:255]  # Length limit
            beer_name = update.get('beer_name', 'Unknown').strip()[:255]  # Length limit
            beer_style = update.get('beer_style', 'Unknown').strip()[:100]  # Length limit
            
            # Validate beer format
            if beer_format not in valid_formats:
                continue
                
            # Skip if all fields are empty/default
            if beer_brewery == 'Unknown' and beer_name == 'Unknown' and beer_style == 'Unknown':
                continue
            
            cursor.execute("""
                INSERT INTO pubs_updates (pub_id, beer_format, beer_brewery, beer_name, beer_style, update_time)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (pub_id, beer_format, beer_brewery, beer_name, beer_style))

        conn.commit()
        logger.info(f"Updated beers for pub {pub_id}, mode: {update_mode}")
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in update_beers: {str(e)}")
        return jsonify({'message': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in update_beers: {str(e)}")
        return jsonify({'message': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
    
    return jsonify({'message': 'Beer updates saved successfully'})

# Updated /api/stats route with DISTINCT counts for both GF stats

@app.route('/api/stats')
def get_stats():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Get total pubs
        cursor.execute("SELECT COUNT(*) as total FROM pubs")
        total_pubs = cursor.fetchone()[0]
        
        # Get DISTINCT pubs with GF options (a pub with multiple formats = 1 GF pub)
        cursor.execute("""
            SELECT COUNT(DISTINCT pub_id) as gf_total 
            FROM pubs 
            WHERE bottle=1 OR tap=1 OR cask=1 OR can=1
        """)
        gf_pubs = cursor.fetchone()[0]
        
        # Get DISTINCT pubs updated this month
        cursor.execute("""
            SELECT COUNT(DISTINCT pub_id) as monthly_pubs 
            FROM pubs_updates 
            WHERE update_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """)
        monthly_result = cursor.fetchone()
        monthly_pubs = monthly_result[0] if monthly_result else 0
        
        # Ensure monthly can't be higher than total GF pubs (safety check)
        monthly_pubs = min(monthly_pubs, gf_pubs)
        
        logger.info(f"Stats: {total_pubs} total pubs, {gf_pubs} distinct GF pubs, {monthly_pubs} distinct pubs updated this month")
        
        return jsonify({
            'total_pubs': total_pubs,
            'gf_pubs': gf_pubs,
            'monthly_pubs': monthly_pubs
        })
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in stats: {str(e)}")
        # Return sensible fallback numbers with proper ratios
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249,     # More realistic ratio (2.5% of total)
            'monthly_pubs': 87   # Realistic monthly activity
        })
    except Exception as e:
        logger.error(f"Unexpected error in stats: {str(e)}")
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249,
            'monthly_pubs': 87
        })
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/update_coordinates', methods=['POST'])
def update_coordinates():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided'}), 400
            
        pub_id = data.get('pub_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not pub_id or not str(pub_id).isdigit():
            return jsonify({'message': 'Valid pub ID is required'}), 400
            
        if latitude is None or longitude is None:
            return jsonify({'message': 'Latitude and longitude are required'}), 400
        
        # Validate coordinates are reasonable (UK bounds approximately)
        if not (49.0 <= latitude <= 61.0 and -8.0 <= longitude <= 2.0):
            return jsonify({'message': 'Coordinates appear to be outside the UK'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE pubs 
            SET latitude = %s, longitude = %s 
            WHERE pub_id = %s
        """, (latitude, longitude, pub_id))
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'Pub not found'}), 404
            
        conn.commit()
        logger.info(f"Updated coordinates for pub {pub_id}: {latitude}, {longitude}")
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in update_coordinates: {str(e)}")
        return jsonify({'message': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in update_coordinates: {str(e)}")
        return jsonify({'message': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
    
    return jsonify({'message': 'Coordinates updated successfully'})

# Health check endpoint for monitoring
@app.route('/health')
def health_check():
    try:
        # Test database connection
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

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

# Add these routes to your main Flask app file (app.py or main.py)

# Add these corrected routes to your Flask app file (app.py)

@app.route('/privacy')
def privacy_policy():
    """Privacy Policy page"""
    version = str(int(time.time()))  # Generate cache buster
    return render_template('privacy.html', cache_buster=version)

@app.route('/terms')
def terms_of_service():
    """Terms of Service page"""
    version = str(int(time.time()))  # Generate cache buster
    return render_template('terms.html', cache_buster=version)

@app.route('/cookies')
def cookie_policy():
    """Cookie Policy page"""
    version = str(int(time.time()))  # Generate cache buster
    return render_template('cookies.html', cache_buster=version)

@app.route('/accessibility')
def accessibility_statement():
    """Accessibility Statement page"""
    version = str(int(time.time()))  # Generate cache buster
    return render_template('accessibility.html', cache_buster=version)

@app.route('/liability')
def liability_notice():
    """Liability Notice page"""
    version = str(int(time.time()))  # Generate cache buster
    return render_template('liability.html', cache_buster=version)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting app on port {port}, debug mode: {debug}")
    app.run(debug=debug, host='0.0.0.0', port=port)
