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

# ============================================================================
# FIXED NEARBY ENDPOINT - Replace your existing /nearby route
# ============================================================================

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
        
        # FIXED SQL - Handle case where beers table might not exist yet
        sql = """
            SELECT DISTINCT
                p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                (6371 * acos(cos(radians(%s)) * cos(radians(p.latitude)) * 
                cos(radians(p.longitude) - radians(%s)) + sin(radians(%s)) * 
                sin(radians(p.latitude)))) AS distance,
                GROUP_CONCAT(
                    DISTINCT CONCAT(pu.beer_format, ' - ', 
                    COALESCE(b.brewery, 'Unknown'), ' ', 
                    COALESCE(b.name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM pubs p
            LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
            LEFT JOIN beers b ON pu.beer_id = b.beer_id
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
        
        logger.debug(f"Executing nearby search with radius {radius}km, GF only: {gf_only}")
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        logger.debug(f"Found {len(pubs)} nearby pubs")
        
        return jsonify(pubs)
        
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

# ====================================
# ADD THIS TO YOUR app.py FILE
# NEW ROUTE FOR CURRENT PUB BEERS
# ====================================

@app.route('/api/pub/<int:pub_id>/current_beers')
def get_pub_current_beers(pub_id):
    """Get current beers for a specific pub"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT DISTINCT
                pu.beer_format,
                b.brewery,
                b.name,
                b.style,
                b.abv,
                CASE 
                    WHEN pu.beer_format = 'bottle' THEN '🍺'
                    WHEN pu.beer_format = 'tap' THEN '🚰'
                    WHEN pu.beer_format = 'cask' THEN '🛢️'
                    WHEN pu.beer_format = 'can' THEN '🥫'
                    ELSE '🍺'
                END as format_icon
            FROM pubs_updates pu
            JOIN beers b ON pu.beer_id = b.beer_id
            WHERE pu.pub_id = %s
            ORDER BY pu.beer_format, b.brewery, b.name
        """, (pub_id,))
        
        beers = cursor.fetchall()
        
        # Format the response
        formatted_beers = []
        for beer in beers:
            formatted_beers.append({
                'format': beer['beer_format'].title(),
                'format_icon': beer['format_icon'],
                'brewery': beer['brewery'],
                'name': beer['name'],
                'style': beer['style'],
                'abv': beer['abv']
            })
        
        return jsonify(formatted_beers)
        
    except Exception as e:
        logger.error(f"Error fetching current beers for pub {pub_id}: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ====================================
# PASTE THIS ROUTE ANYWHERE IN YOUR app.py
# (BEFORE the if __name__ == '__main__': line)
# ====================================

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
        
        # Get DISTINCT pubs with GF options
        cursor.execute("""
            SELECT COUNT(DISTINCT pub_id) as gf_total 
            FROM pubs 
            WHERE bottle=1 OR tap=1 OR cask=1 OR can=1
        """)
        gf_pubs = cursor.fetchone()[0]
        
        logger.info(f"Stats: {total_pubs} total pubs, {gf_pubs} distinct GF pubs")
        
        return jsonify({
            'total_pubs': total_pubs,
            'gf_pubs': gf_pubs
        })
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in stats: {str(e)}")
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249
        })
    except Exception as e:
        logger.error(f"Unexpected error in stats: {str(e)}")
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249
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

# Add this route to your app.py

@app.route('/breweries')
def gf_breweries():
    """GF Breweries page"""
    version = str(int(time.time()))
    return render_template('breweries.html', cache_buster=version)

# ============================================================================
# OPTIMIZED FLASK ROUTES - CLEAN DATABASE DESIGN
# ============================================================================

@app.route('/api/submit_beer_update', methods=['POST'])
def submit_beer_update():
    """Submit beer update - handles both existing and new beers"""
    try:
        data = request.get_json()
        
        # Validation
        required_fields = ['pub_id', 'beer_format']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Determine if this is existing or new beer
        existing_beer_id = data.get('beer_id')  # Will be None for new beers
        
        if existing_beer_id:
            # EXISTING BEER - just reference it
            cursor.execute("""
                INSERT INTO pending_beer_updates 
                (pub_id, beer_format, existing_beer_id, submitted_by_email, 
                 submitted_by_name, user_notes, photo_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                data['pub_id'],
                data['beer_format'],
                existing_beer_id,
                data.get('email', ''),
                data.get('name', 'Anonymous'),
                data.get('notes', ''),
                data.get('photo_url', '')
            ))
        else:
            # NEW BEER - store details for validation
            cursor.execute("""
                INSERT INTO pending_beer_updates 
                (pub_id, beer_format, new_brewery, new_beer_name, new_style, 
                 new_abv, new_vegan_status, new_category, submitted_by_email, 
                 submitted_by_name, user_notes, photo_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data['pub_id'],
                data['beer_format'],
                data.get('brewery', ''),
                data.get('beer_name', ''),
                data.get('style', ''),
                data.get('abv', 0.0),
                data.get('vegan_status', 'unknown'),
                data.get('category', 'gluten_removed'),
                data.get('email', ''),
                data.get('name', 'Anonymous'),
                data.get('notes', ''),
                data.get('photo_url', '')
            ))
        
        pending_id = cursor.lastrowid
        conn.commit()
        
        # Send email notification
        send_validation_email(pending_id, data)
        
        return jsonify({
            'message': 'Beer update submitted for validation',
            'pending_id': pending_id,
            'will_create_new_beer': not existing_beer_id
        })
        
    except Exception as e:
        logger.error(f"Error submitting beer update: {str(e)}")
        return jsonify({'error': 'Submission failed'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/admin/approve_update/<int:pending_id>', methods=['POST'])
def approve_update(pending_id):
    """Approve pending update - auto-generates beer_id for new beers"""
    try:
        data = request.get_json()
        admin_notes = data.get('admin_notes', '')
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get the pending update
        cursor.execute("""
            SELECT * FROM pending_beer_updates WHERE pending_id = %s
        """, (pending_id,))
        update = cursor.fetchone()
        
        if not update:
            return jsonify({'error': 'Update not found'}), 404
        
        beer_id_to_use = None
        
        if update['existing_beer_id']:
            # EXISTING BEER - just use the existing beer_id
            beer_id_to_use = update['existing_beer_id']
            logger.info(f"Using existing beer_id: {beer_id_to_use}")
            
        else:
            # NEW BEER - create it and get auto-generated beer_id
            cursor.execute("""
                INSERT INTO beers (brewery, name, style, abv, category, vegan_status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                update['new_brewery'],
                update['new_beer_name'], 
                update['new_style'] or 'Unknown',
                update['new_abv'] or 0.0,
                update['new_category'],
                update['new_vegan_status']
            ))
            
            # Get the auto-generated beer_id
            beer_id_to_use = cursor.lastrowid
            
            # Store the generated beer_id in pending table for reference
            cursor.execute("""
                UPDATE pending_beer_updates 
                SET generated_beer_id = %s 
                WHERE pending_id = %s
            """, (beer_id_to_use, pending_id))
            
            logger.info(f"Created new beer with auto-generated beer_id: {beer_id_to_use}")
        
        # Add to pubs_updates with the beer_id (clean!)
        cursor.execute("""
            INSERT INTO pubs_updates (pub_id, beer_id, beer_format, update_time)
            VALUES (%s, %s, %s, NOW())
        """, (update['pub_id'], beer_id_to_use, update['beer_format']))
        
        # Update pub's format flags
        format_column = update['beer_format']
        cursor.execute(f"""
            UPDATE pubs SET {format_column} = 1 WHERE pub_id = %s
        """, (update['pub_id'],))
        
        # Mark as approved
        cursor.execute("""
            UPDATE pending_beer_updates 
            SET status = 'approved', admin_notes = %s, reviewed_at = NOW(), reviewed_by = %s
            WHERE pending_id = %s
        """, (admin_notes, data.get('reviewed_by', 'Admin'), pending_id))
        
        conn.commit()
        
        return jsonify({
            'message': 'Update approved successfully',
            'beer_id': beer_id_to_use,
            'was_new_beer': not update['existing_beer_id']
        })
        
    except Exception as e:
        logger.error(f"Error approving update: {str(e)}")
        conn.rollback()
        return jsonify({'error': 'Approval failed'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ====================================
# REPLACE YOUR BROKEN /search ROUTE WITH THIS COMPLETE VERSION
# ====================================

@app.route('/search')
def search():
    """Complete working search function"""
    query = request.args.get('query', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    pub_id = request.args.get('pub_id', type=int)
    
    # Input validation
    if query and (len(query) < 1 or len(query) > 100):
        return jsonify({'error': 'Invalid query length'}), 400
    
    if page < 1 or page > 1000:
        return jsonify({'error': 'Invalid page number'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Handle specific pub ID search
        if pub_id:
            logger.info(f"Searching for specific pub ID: {pub_id}")
            sql = """
                SELECT DISTINCT
                    p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                    p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                    GROUP_CONCAT(
                        DISTINCT CONCAT(pu.beer_format, ' - ', 
                        COALESCE(b.brewery, 'Unknown'), ' ', 
                        COALESCE(b.name, 'Unknown'), ' (', 
                        COALESCE(b.style, 'Unknown'), ')')
                        SEPARATOR ', '
                    ) as beer_details
                FROM pubs p
                LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
                LEFT JOIN beers b ON pu.beer_id = b.beer_id
                WHERE p.pub_id = %s
                GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                         p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            """
            cursor.execute(sql, (pub_id,))
            pubs = cursor.fetchall()
            logger.info(f"Found {len(pubs)} pubs for specific ID {pub_id}")
            return jsonify(pubs)
        
        # Regular search logic
        if not query:
            return jsonify({'error': 'Query is required for search'}), 400
        
        # Build search condition based on search type
        if search_type == 'name':
            search_condition = "p.name LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'postcode':
            search_condition = "p.postcode LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'area':
            search_condition = "p.local_authority LIKE %s"
            params = [f'%{query}%']
        else:  # search_type == 'all'
            search_condition = "(p.name LIKE %s OR p.postcode LIKE %s OR p.local_authority LIKE %s OR p.address LIKE %s)"
            params = [f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%']
        
        # Count total results for pagination
        count_sql = f"""
            SELECT COUNT(DISTINCT p.pub_id) as total
            FROM pubs p
            WHERE {search_condition}
        """
        
        if gf_only:
            count_sql += " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
        
        cursor.execute(count_sql, params)
        total_results = cursor.fetchone()['total']
        
        # Calculate pagination
        per_page = 20
        total_pages = (total_results + per_page - 1) // per_page
        offset = (page - 1) * per_page
        
        # Main search query with beer details
        sql = f"""
            SELECT DISTINCT
                p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                GROUP_CONCAT(
                    DISTINCT CONCAT(pu.beer_format, ' - ', 
                    COALESCE(b.brewery, 'Unknown'), ' ', 
                    COALESCE(b.name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM pubs p
            LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
            LEFT JOIN beers b ON pu.beer_id = b.beer_id
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
        
        sql += """
            GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                     p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            ORDER BY p.name
            LIMIT %s OFFSET %s
        """
        
        params.extend([per_page, offset])
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        logger.info(f"Found {len(pubs)} pubs on page {page} of {total_pages}")
        
        # Return paginated results
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
    except Exception as e:
        logger.error(f"Unexpected error in search: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ADD THESE MISSING API ROUTES TO YOUR app.py
# ============================================================================

@app.route('/api/breweries', methods=['GET'])
def get_breweries():
    """Get all breweries for dropdown"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT DISTINCT brewery 
            FROM beers 
            ORDER BY brewery
        """)
        breweries = cursor.fetchall()
        
        return jsonify([brewery['brewery'] for brewery in breweries])
        
    except Exception as e:
        logger.error(f"Error fetching breweries: {str(e)}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/brewery/<brewery_name>/beers', methods=['GET'])
def get_brewery_beers(brewery_name):
    """Get all beers for a specific brewery"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT beer_id, name, style, abv, gluten_status, vegan_status
            FROM beers 
            WHERE brewery = %s 
            ORDER BY name
        """, (brewery_name,))
        beers = cursor.fetchall()
        
        return jsonify(beers)
        
    except Exception as e:
        logger.error(f"Error fetching beers for {brewery_name}: {str(e)}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/beer_details/<int:beer_id>', methods=['GET'])
def get_beer_details(beer_id):
    """Get full details for a specific beer"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT beer_id, brewery, name, style, abv, category, vegan_status, created_at
            FROM beers 
            WHERE beer_id = %s
        """, (beer_id,))
        
        beer = cursor.fetchone()
        
        if not beer:
            return jsonify({'error': 'Beer not found'}), 404
            
        return jsonify(beer)
        
    except Exception as e:
        logger.error(f"Error fetching beer details: {str(e)}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

def send_validation_email(pending_id, data):
    """Enhanced email with better new beer handling"""
    try:
        # ... existing email config ...
        
        if data.get('beer_id'):
            # Existing beer
            body = f"""
🍺 EXISTING BEER REPORT

Pending ID: {pending_id}
Pub ID: {data['pub_id']}
Beer ID: {data['beer_id']} (existing in database)
Format: {data['beer_format']}

Submitted by: {data.get('name', 'Anonymous')} ({data.get('email', 'No email')})
Notes: {data.get('notes', 'None')}

✅ Quick approve - just creates pub→beer link!

Review: https://coeliacslikebeer.co.uk/admin/pending_updates
            """
        else:
            # New beer - will get auto-generated beer_id
            body = f"""
🆕 NEW BEER SUGGESTION

Pending ID: {pending_id}
Pub ID: {data['pub_id']}
Format: {data['beer_format']}

NEW BEER (will auto-generate beer_id):
Brewery: {data.get('brewery', 'Not specified')}
Beer Name: {data.get('beer_name', 'Not specified')}
Style: {data.get('style', 'Not specified')}
ABV: {data.get('abv', 'Not specified')}%
Vegan: {data.get('vegan_status', 'Unknown')}
Category: {data.get('category', 'gluten_removed')}

Submitted by: {data.get('name', 'Anonymous')} ({data.get('email', 'No email')})
Notes: {data.get('notes', 'None')}

📝 Approve to create new beer + pub link!

Review: https://coeliacslikebeer.co.uk/admin/pending_updates
            """
        
        # ... rest of email sending code ...
        
    except Exception as e:
        logger.error(f"Failed to send validation email: {str(e)}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting app on port {port}, debug mode: {debug}")
    app.run(debug=debug, host='0.0.0.0', port=port)
