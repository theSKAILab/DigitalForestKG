"""
Routes and views for the flask application.
"""
from flask import Flask
app = Flask(__name__)

from datetime import datetime
from flask import render_template, request, jsonify
from SPARQLWrapper import SPARQLWrapper, POST, JSON
import pandas as pd
from shapely import wkt
import geopandas as gpd
#import folium
#from folium.features import GeoJsonTooltip
#import matplotlib.pyplot as plt
#import seaborn as sns
#import mpld3
import numpy as np
from sklearn import preprocessing
from sklearn.cluster import KMeans
import json
import branca
import branca.colormap as cm
import ssl
#global results_table

# Ascript to bypass ssl verification (only for development mode)
ssl._create_default_https_context = ssl._create_unverified_context

# SPARQL ENDPOINT
sparql_endpoint = SPARQLWrapper("https://gdb.acg.maine.edu:7200/repositories/DigitalForestGraph")
sparql_endpoint.setCredentials("digital-forest-endpoint", "skailab")
sparql_endpoint.setMethod(POST)

def range_check(row, index, lower, upper):
    if (row[index] >= lower) and (row[index] <= upper):
        val = 1
    else:
        val = 0
    return val

def get_namespace():
    return """PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
        PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>"""

def construct_minmax_query_selreg(region, quality):
    region_values = ' '.join(f'"{r}"' for r in region)

    if len(region) == 1:
        s2celltype = 'S2Cell_level14' 
    else:
        s2celltype = 'S2Cell_level13'

    query = f"""
    SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
    WHERE {{VALUES ?county {{ {region_values} }}
            ?amt a dfds:{quality};
                stad:hasQuantitativeValue [qudt:numericValue ?val].
            ?amt stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:{s2celltype};
                fio:locatedIn [rdfs:label ?county].
        }}"""
    
    return query

def construct_minmax_query_wkt(wkt_geom, quality):

    wkt_text = f"'''<http://www.opengis.net/def/crs/EPSG/8.5/4326>{wkt_geom}'''^^<http://www.opengis.net/ont/geosparql#wktLiteral>"
    query = f"""
        SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
        WHERE {{
            ?amt a dfds:{quality};
                stad:hasQuantitativeValue [qudt:numericValue ?val].
            ?amt stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:S2Cell_level13;
                geo:hasGeometry [geo:asWKT ?geom].
            FILTER (geof:sfIntersects(?geom, {wkt_text})).
        }}"""
    
    return query

def construct_category_query(region, wkt_geom, quality):
    if region:
        region_values = ' '.join(f'"{r}"' for r in region)
        s2celltype = 'S2Cell_level14' if len(region) == 1 else 'S2Cell_level13'
        query = f"""
        SELECT DISTINCT ?class
        WHERE {{
            VALUES ?county {{ {region_values} }}
            ?prop a dfds:{quality};
                  stad:hasQualitativeValue ?classvalue.
            ?classvalue rdfs:label ?class.
            ?prop stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:{s2celltype};
                fio:locatedIn [rdfs:label ?county].
        }}"""
    elif wkt_geom:
        wkt_text = f"'''<http://www.opengis.net/def/crs/EPSG/8.5/4326>{wkt_geom}'''^^<http://www.opengis.net/ont/geosparql#wktLiteral>"
        query = f"""
        SELECT DISTINCT ?class
        WHERE {{
            ?prop a dfds:{quality};
                stad:hasQualitativeValue ?classvalue.
            ?classvalue rdfs:label ?class.
            ?prop stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:S2Cell_level13;
                geo:hasGeometry [geo:asWKT ?geom].
            FILTER (geof:sfIntersects(?geom, {wkt_text})).
        }}"""
    else:
        query = ""
    return query

"""
Routes and views for the flask application.
Provides various flask end points that support various functions of the app
"""

@app.route('/')
@app.route('/home')
def home():
    """Renders the home page."""
    return render_template(
        'index.html',
        title='Home Page',
        year=datetime.now().year,
    )

@app.route('/contact')
def contact():
    """Renders the contact page."""
    return render_template(
        'contact.html',
        title='Contact',
        year=datetime.now().year,
        message='Your contact page.'
    )

@app.route('/about')
def about():
    """Renders the about page."""
    return render_template(
        'about.html',
        title='About',
        year=datetime.now().year,
        message='INSPIRES DIGITA FOREST.'
    )

@app.route('/gr_query')
def graphical_query():
    return render_template('graphical_query.html',
                           title = "Select Query parameters")


@app.route('/datasets')
def dataHelp():
  
    return render_template('dataHelp.html')


@app.route('/sp_query')
def sparql_query():
    """Show form for sparql query"""
    return render_template('sparql_query.html',title='Enter query:')

@app.route('/minmax', methods=['GET', 'POST'])
def minmax():
    """
    Checks for minimum and maximum values of quantities and use them as constraints for sliders
    to guide user selection
    """
    region = request.form.getlist("selectedregion")
    wkt_geom = request.form.get("wkt")
    quality = request.form.get("quality")

    name_space = """PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
        PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>"""
    
    end_query = "}"

    if region:
        region_values = '"' + '""'.join(map(str, region))+ '"'

        if len(region) == 1:
            s2celltype = 'S2Cell_level14'
        else:
            s2celltype = 'S2Cell_level13'

        select_query = f"""SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
        WHERE {{VALUES ?county {{ {region_values} }}
            ?amt a dfds:{quality};
                stad:hasQuantitativeValue [qudt:numericValue ?val].
            ?amt stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:{s2celltype};
                fio:locatedIn [rdfs:label ?county].
        }}"""
           

    elif wkt_geom:
        wkt_text = "'''<http://www.opengis.net/def/crs/EPSG/8.5/4326>%s'''^^<http://www.opengis.net/ont/geosparql#wktLiteral>" % wkt_geom

        select_query = f"""
        SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
        WHERE {{
            ?amt a dfds:{quality};
                stad:hasQuantitativeValue [qudt:numericValue ?val].
            ?amt stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:S2Cell_level13;
                geo:hasGeometry [geo:asWKT ?geom].
            FILTER (geof:sfIntersects(?geom, {wkt_text})).
        }}"""
        
    
    minmax_querystring = name_space + "\n" + select_query

    sparql_endpoint.setQuery(minmax_querystring)
    sparql_endpoint.setReturnFormat(JSON)
    minmaxresults = sparql_endpoint.query().convert()
    for result in minmaxresults["results"]["bindings"]:
        datamax = result["datamax"]["value"]
        datamin = result["datamin"]["value"]

    return jsonify({'datamin':datamin, 'datamax':datamax})

@app.route('/categorygroup', methods=['GET', 'POST'])
def categorygroup():

    """
    Checks for actual categorical values in the graph use to constraint user selection
    """
    
    region = request.form.getlist("selectedregion")
    wkt_geom = request.form.get("wkt")
    quality = request.form.get("quality")

    name_space = """PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
        PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>"""
    
    end_query = "}"

    if region:
        region_values = '"' + '""'.join(map(str, region))+ '"'

        if len(region) == 1:
            s2celltype = 'S2Cell_level14'
        else:
            s2celltype = 'S2Cell_level13'

        select_query = f"""SELECT DISTINCT ?class
        WHERE {{
            VALUES ?county {{ {region_values} }}
            ?prop a dfds:{quality};
                  stad:hasQualitativeValue ?classvalue.
            ?classvalue rdfs:label ?class.
            ?prop stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:{s2celltype};
                fio:locatedIn [rdfs:label ?county].
        }}"""

    elif wkt_geom:
        wkt_text = "'''<http://www.opengis.net/def/crs/EPSG/8.5/4326>%s'''^^<http://www.opengis.net/ont/geosparql#wktLiteral>" % wkt_geom

        select_query = f"""SELECT DISTINCT ?class
        WHERE {{
            ?prop a dfds:{quality};
                stad:hasQualitativeValue ?classvalue.
            ?classvalue rdfs:label ?class.
            ?prop stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:S2Cell_level13;
                geo:hasGeometry [geo:asWKT ?geom].
            FILTER (geof:sfIntersects(?geom, {wkt_text})).
        }}"""

    category_querystring = name_space + "\n" + select_query
    
    sparql_endpoint.setQuery(category_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    categoryresults = sparql_endpoint.query().convert()
    
    class_list = []
    for result in categoryresults["results"]["bindings"]:
        class_ = result["class"]["value"]
        class_list.append(class_)

    return jsonify({'classlisthtml':render_template('itemList.html', class_list=class_list)})

@app.route('/sp_query', methods=['POST'])
def query_result():

    """Get query and process query"""
    queryString = request.form['query_text']
    sparql_endpoint.setQuery(queryString)

    sparql_endpoint.setReturnFormat(JSON)
    results = sparql_endpoint.query().convert()
    res = {}
    res["region"]=[]
    res["mat"] = []
    res["ge"] = []
    for result in results["results"]["bindings"]:

        res["region"].append(result["region"]["value"])
        res["mat"].append(result["mat"]["value"])
        res["ge"].append(result["geometry"]["value"])

    res_table = pd.DataFrame.from_dict(res, orient="index").transpose()
    res_table["geometry"] = res_table['ge'].apply(lambda x: x.split('>')[1])

    res_html = res_table.to_html()

    """Create initial map centered on maine."""
    initialize_map = folium.Map(location = [45.56528, -69.56528], zoom_start = 7,
                 max_lat =47.391892 , max_lon =-66.793541 , min_lat = 42.694265 , min_lon =-71.0, max_bounds = True )

    map_data = res_table.dropna()
    map_data["mat"] = pd.to_numeric(map_data["mat"])
    map_data['geometry'] = map_data['geometry'].apply(wkt.loads)
    gdf = gpd.GeoDataFrame(map_data, crs='epsg:4326')

    add_choropleth = folium.Choropleth(
    geo_data= gdf,
    name='choropleth',
    data=gdf,
    columns=['region', 'mat'], ##the columns containing the data
    key_on='properties.region',
    fill_color='YlOrRd', ##color style for the choropleth
    bins = 9,
    fill_opacity=1,
    line_opacity=1,
    legend_name='Annual Mean Temperature', 
    highlight = True
    ).add_to(initialize_map)

    add_choropleth.geojson.add_child(folium.features.GeoJsonTooltip(["region", "mat"]))

    """Renders results as html."""
    return render_template(
        'query_result.html',
        title='Enter query:',
        result_title='query results',
        year=datetime.now().year,
        query_result = initialize_map._repr_html_()
    )

@app.route('/taskpage')
def taskpage():

    return render_template('taskpage.html')

@app.route('/appHome')
def appHome():

    return render_template('appHome.html')

@app.route('/environmentalDataTask')
def environmentalDataTask():

    return render_template('environmentalDataTask.html')

@app.route('/treeinventorytask')
def treeinventorytask():

    return render_template('treeInventorytask.html')

@app.route('/treepreferencestask')
def treepreferencestask():

    return render_template('treePreferencesTask.html')

@app.route('/all_areas', methods=['GET'])
def all_areas():
    """
    Fetch all counties from GeoJSON file and assign colors
    """
    import json
    
    # Load the counties GeoJSON file
    geojson_path = 'static/Counties_ME.geojson'
    
    try:
        with open(geojson_path, 'r') as f:
            counties_geojson = json.load(f)
        
        # Color palette: diverse set of colors for visual separation
        colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6',
            '#F5A9A9', '#95E1D3', '#A3CB38', '#F8A5C8', '#81ECEC',
            '#FAD7A0', '#D7BDE2', '#A9DFBF', '#F9E79F', '#FADBD8',
            '#D5DBDB', '#D2EBF0', '#FCF3CF', '#EBDEF0', '#E8DAEF'
        ]
        
        # Assign colors to each feature
        if 'features' in counties_geojson:
            for idx, feature in enumerate(counties_geojson['features']):
                feature['properties']['color'] = colors[idx % len(colors)]
        
        return jsonify({'all_areas_geoj': json.dumps(counties_geojson)})
    
    except Exception as e:
        print(f"Error loading counties GeoJSON: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/userpara', methods=['POST'])
def userpara():

    global results_table

    county = request.form.getlist("selectedregion")
    wkt_geom = request.form.get("wkt")

    userparadata = {}
    userparadata['aspect'] = request.form.getlist("selaspect")
    userparadata['soildrainage'] = request.form.getlist("seldrainage")
    userparadata['lithology'] = request.form.getlist("sellit")
    userparadata['landcover'] = request.form.getlist("sellandcover")
    userparadata['mat'] = request.form.getlist("matrange")
    userparadata['tavesm'] = request.form.getlist("tavesmrange")
    userparadata['tavewt'] = request.form.getlist("tavewtrange")
    userparadata['taveat'] = request.form.getlist("taveatrange")
    userparadata['tavesp'] = request.form.getlist("tavesprange")
    userparadata['mcmt'] = request.form.getlist("mcmtrange")
    userparadata['mwmt'] = request.form.getlist("mwmtrange")
    userparadata['ext'] = request.form.getlist("extrange")
    userparadata['emt'] = request.form.getlist("emtrange")
    userparadata['map'] = request.form.getlist("maprange")
    userparadata['pptsm'] = request.form.getlist("pptsmrange")
    userparadata['pptwt'] = request.form.getlist("pptwtrange")
    userparadata['pptat'] = request.form.getlist("pptatrange")
    userparadata['pptsp'] = request.form.getlist("pptsprange")
    userparadata['pas'] = request.form.getlist("pasrange")
    userparadata['nffd'] = request.form.getlist("nffdrange")
    userparadata['rh'] = request.form.getlist("rhrange")
    userparadata['minelevation'] = request.form.getlist("minelevationrange")
    userparadata['maxelevation'] = request.form.getlist("maxelevationrange")
    userparadata['meanelevation'] = request.form.getlist("meanelevationrange")
    userparadata['meanslope'] = request.form.getlist("meansloperange")
    userparadata['aws150'] = request.form.getlist("aws150range")

    if county:
        county_values = '"' + '""'.join(map(str, county))+ '"'

        if len(county) == 1:
            s2celltype = 'S2Cell_level14'
        else:
             s2celltype = 'S2Cell_level13'

        begin_query = """select ?cellID ?geom
        where{VALUES ?county {%s}
        ?region rdf:type dfds:%s;
            dfds:cellID ?cellID;
            geo:hasGeometry [geo:asWKT ?geom];
            fio:locatedIn [rdfs:label ?county].""" % (county_values, s2celltype)

    elif wkt_geom:
        wkt_text = "'''<http://www.opengis.net/def/crs/EPSG/8.5/4326>%s'''^^<http://www.opengis.net/ont/geosparql#wktLiteral>" % wkt_geom

        begin_query = """select ?cellID ?geom
        where{
        ?region rdf:type dfds:S2Cell_level13;
            dfds:cellID ?cellID;
            geo:hasGeometry [geo:asWKT ?geom].
       FILTER (geof:sfIntersects(?geom, %s)).""" % (wkt_text)

    processeddata = {}
    for key, value in userparadata.items():
        if value:
            processeddata[key] = value

    name_space = """PREFIX stad: <http://purl.org/spatialai/stad/v2/core/> 
    PREFIX qudt: <http://qudt.org/schema/qudt/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX time: <http://www.w3.org/2006/time#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>  
    PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
    PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>"""

    end_query = "}"

    filtered_region_queryString = name_space + "\n" + begin_query

    aspect_key = 'aspect'
    if aspect_key in processeddata:
        sel_aspect = processeddata['aspect']
        sel_aspect_value = "'" + "','".join(map(str, sel_aspect)) + "'"
        aspect_query = """[] a dfds:DominantAspectClass;
                            stad:hasSpatialCoverage ?region;
                            stad:hasQualitativeValue [rdfs:label ?aspectclass].
        FILTER (?aspectclass IN (%s) )""" % sel_aspect_value

        filtered_region_queryString = filtered_region_queryString + "\n" + aspect_query

    dr_key = 'soildrainage'
    if dr_key in processeddata:
        sel_drainage = processeddata['soildrainage']
        sel_soildrainage_value = "'" + "','".join(map(str, sel_drainage)) + "'"
        dr_query = """[] a dfds:DominantSoilDrainageClass;
                            stad:hasSpatialCoverage ?region;
                            stad:hasQualitativeValue [rdfs:label ?soildrainage].
        FILTER (?soildrainage IN (%s) )""" % sel_soildrainage_value

        filtered_region_queryString = filtered_region_queryString + "\n" + dr_query 
        
    lit_key = 'lithology'
    if lit_key in processeddata:
        sel_lithology = processeddata['lithology']
        sel_lithology_value = "'" + "','".join(map(str, sel_lithology)) + "'"
        lit_query = """[] a dfds:GeneralizedLithology;
                            stad:hasSpatialCoverage ?region;
                            stad:hasQualitativeValue [rdfs:label ?lithology].
        FILTER (?lithology IN (%s) )""" % sel_lithology_value

        filtered_region_queryString = filtered_region_queryString + "\n" + lit_query

    landcover_key = 'landcover'
    if landcover_key in processeddata:
        sel_landcover = processeddata['landcover']
        sel_landcover_value = "'" + "','".join(map(str, sel_landcover)) + "'"
        landcover_query = """[] a dfds:GeneralizedLandCover;
                            stad:hasSpatialCoverage ?region;
                            stad:hasQualitativeValue [rdfs:label ?landcover].
        FILTER (?landcover IN (%s) )""" % sel_landcover_value

        filtered_region_queryString = filtered_region_queryString + "\n" + landcover_query 

    mat_key = "mat"
    if mat_key in processeddata:
        sel_mat = processeddata['mat']
        mat_query = """[] a dfds:CLNA_AnnualMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?mat].
        FILTER (?mat >= %s && ?mat <= %s)""" % (sel_mat[0], sel_mat[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + mat_query

    tavesm_key = "tavesm"
    if tavesm_key in processeddata:
        sel_tavesm = processeddata['tavesm']
        tavesm_query = """[] a dfds:CLNA_SummerMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?tavesm].
        FILTER (?tavesm >= %s && ?tavesm <= %s)""" % (sel_tavesm[0], sel_tavesm[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + tavesm_query

    tavewt_key = "tavewt"
    if tavewt_key in processeddata:
        sel_tavewt = processeddata['tavewt']
        tavewt_query = """[] a dfds:CLNA_WinterMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?tavewt].
        FILTER (?tavewt >= %s && ?tavewt <= %s)""" % (sel_tavewt[0], sel_tavewt[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + tavewt_query

    taveat_key = "taveat"
    if taveat_key in processeddata:
        sel_taveat = processeddata['taveat']
        taveat_query = """[] a dfds:CLNA_FallMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?taveat].
        FILTER (?taveat >= %s && ?taveat <= %s)""" % (sel_taveat[0], sel_taveat[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + taveat_query

    tavesp_key = "tavesp"
    if tavesp_key in processeddata:
        sel_tavesp = processeddata['tavesp']
        tavesp_query = """[] a dfds:CLNA_SpringMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?tavesp].
        FILTER (?tavesp >= %s && ?tavesp <= %s)""" % (sel_tavesp[0], sel_tavesp[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + tavewt_query

    mcmt_key = "mcmt"
    if mcmt_key in processeddata:
        sel_mcmt = processeddata['mcmt']
        mcmt_query = """[] a dfds:CLNA_ColdestMonthMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?mcmt].
        FILTER (?mcmt >= %s && ?mcmt <= %s)""" % (sel_mcmt[0], sel_mcmt[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + mcmt_query

    mwmt_key = "mwmt"
    if mwmt_key in processeddata:
        sel_mwmt = processeddata['mwmt']
        mwmt_query = """[] a dfds:CLNA_WarmestMonthMeanTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?mwmt].
        FILTER (?mwmt >= %s && ?mwmt <= %s)""" % (sel_mwmt[0], sel_mwmt[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + mwmt_query

    ext_key = "ext"
    if ext_key in processeddata:
        sel_ext = processeddata['ext']
        ext_query = """[] a dfds:CLNA_ExtremeMaximumTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?ext].
        FILTER (?ext >= %s && ?ext <= %s)""" % (sel_ext[0], sel_ext[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + ext_query

    emt_key = "emt"
    if emt_key in processeddata:
        sel_emt = processeddata['emt']
        emt_query = """[] a dfds:CLNA_ExtremeMinimumTemperature1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?emt].
        FILTER (?emt >= %s && ?emt <= %s)""" % (sel_emt[0], sel_emt[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + emt_query

    map_key = "map"
    if map_key in processeddata:
        sel_map = processeddata['map']
        map_query = """[] a dfds:CLNA_AnnualMeanPrecipitation1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?map].
        FILTER (?map >= %s && ?map <= %s)""" % (sel_map[0], sel_map[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + map_query

    pptsm_key = "pptsm"
    if pptsm_key in processeddata:
        sel_pptsm = processeddata['pptsm']
        pptsm_query = """[] a dfds:CLNA_SummerPrecipitation1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?pptsm].
        FILTER (?pptsm >= %s && ?pptsm <= %s)""" % (sel_pptsm[0], sel_pptsm[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + pptsm_query

    pptwt_key = "pptwt"
    if pptwt_key in processeddata:
        sel_pptwt = processeddata['pptwt']
        pptwt_query = """[] a dfds:CLNA_WinterPrecipitation1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?pptwt].
        FILTER (?pptwt >= %s && ?pptwt <= %s)""" % (sel_pptwt[0], sel_pptwt[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + pptwt_query

    pptat_key = "pptat"
    if pptat_key in processeddata:
        sel_pptat = processeddata['pptat']
        pptat_query = """[] a dfds:CLNA_FallPrecipitation1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?pptat].
        FILTER (?pptat >= %s && ?pptat <= %s)""" % (sel_pptat[0], sel_pptat[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + pptat_query

    pptsp_key = "pptsp"
    if pptsp_key in processeddata:
        sel_pptsp = processeddata['pptsp']
        pptsp_query = """[] a dfds:CLNA_SpringPrecipitation1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?pptsp].
        FILTER (?pptsp >= %s && ?pptsp <= %s)""" % (sel_pptsp[0], sel_pptsp[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + pptsp_query

    pas_key = "pas"
    if pas_key in processeddata:
        sel_pas = processeddata['pas']
        pas_query = """[] a dfds:CLNA_PrecipitationAsSnow1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?pas].
        FILTER (?pas >= %s && ?pas <= %s)""" % (sel_pas[0], sel_pas[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + pas_query

    nffd_key = "nffd"
    if nffd_key in processeddata:
        sel_nffd = processeddata['nffd']
        nffd_query = """[] a dfds:CLNA_NumberOfFrostFreeDays1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?nffd].
        FILTER (?nffd >= %s && ?nffd <= %s)""" % (sel_nffd[0], sel_nffd[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + nffd_query

    rh_key = "rh"
    if rh_key in processeddata:
        sel_rh = processeddata['rh']
        rh_query = """[] a dfds:CLNA_MeanAnnualRelativeHumidity1991-2020;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?rh].
        FILTER (?rh >= %s && ?rh <= %s)""" % (sel_rh[0], sel_rh[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + rh_query

    minelevation_key = "minelevation"
    if minelevation_key in processeddata:
        sel_minelevation = processeddata['minelevation']
        minelevation_query = """[] a dfds:MinimumElevation;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?minelevation].
        FILTER (?minelevation >= %s && ?minelevation <= %s)""" % (sel_minelevation[0], sel_minelevation[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + minelevation_query

    maxelevation_key = "maxelevation"
    if maxelevation_key in processeddata:
        sel_maxelevation = processeddata['maxelevation']
        maxelevation_query = """[] a dfds:MaximumElevation;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?maxelevation].
        FILTER (?maxelevation >= %s && ?maxelevation <= %s)""" % (sel_maxelevation[0], sel_maxelevation[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + maxelevation_query

    meanelevation_key = "meanelevation"
    if meanelevation_key in processeddata:
        sel_meanelevation = processeddata['meanelevation']
        meanelevation_query = """[] a dfds:MeanElevation;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?meanelevation].
        FILTER (?meanelevation >= %s && ?meanelevation <= %s)""" % (sel_meanelevation[0], sel_meanelevation[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + meanelevation_query

    meanslope_key = "meanslope"
    if meanslope_key in processeddata:
        sel_meanslope = processeddata['meanslope']
        meanslope_query = """[] a dfds:MeanSlope;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?meanslope].
        FILTER (?meanslope >= %s && ?meanslope <= %s)""" % (sel_meanslope[0], sel_meanslope[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + meanslope_query

    aws150_key = "aws150"
    if aws150_key in processeddata:
        sel_aws150 = processeddata['aws150']
        aws150_query = """[] a dfds:AverageWaterStorage150cm;
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?aws150].
        FILTER (?aws150 >= %s && ?aws150 <= %s)""" % (sel_aws150[0], sel_aws150[1])

        filtered_region_queryString = filtered_region_queryString + "\n" + aws150_query

    filtered_region_queryString = filtered_region_queryString + "\n" + end_query

    selected_region_queryString = name_space + "\n" + begin_query + "\n" + end_query

    """query graphDB for all selected region"""
    
    sparql_endpoint.setQuery(selected_region_queryString)

    sparql_endpoint.setReturnFormat(JSON)
    selected_region_results = sparql_endpoint.query().convert()
    selected_region_dic = {}
    selected_region_dic['cellID'] = []
    selected_region_dic['geometry'] = []
        
    for result in selected_region_results["results"]["bindings"]:
        selected_region_dic['geometry'].append(result['geom']["value"].split('>')[1])
        selected_region_dic['cellID'].append(result["cellID"]["value"])

    selected_region_table = pd.DataFrame.from_dict(selected_region_dic)
    selected_region_table['geometry'] = selected_region_table['geometry'].apply(wkt.loads)
    selected_region_gdf = gpd.GeoDataFrame(selected_region_table, crs='EPSG:4326')
    selected_region_geoj = selected_region_gdf.to_json()
    
    """query graphDB for all filtered region"""
    
    sparql_endpoint.setQuery(filtered_region_queryString)

    sparql_endpoint.setReturnFormat(JSON)
    filtered_region_results = sparql_endpoint.query().convert()
    filtered_region_dic = {}
    filtered_region_dic['cellID'] = []
    filtered_region_dic['geometry'] = []
        
    for result in filtered_region_results["results"]["bindings"]:
        filtered_region_dic['geometry'].append(result['geom']["value"].split('>')[1])
        filtered_region_dic['cellID'].append(result["cellID"]["value"])

    filtered_region_table = pd.DataFrame.from_dict(filtered_region_dic)
    filtered_region_table['geometry'] = filtered_region_table['geometry'].apply(wkt.loads)
    filtered_region_gdf = gpd.GeoDataFrame(filtered_region_table, crs='EPSG:4326')
    filtered_region_geoj = filtered_region_gdf.to_json()

    return jsonify({'selected_region_geoj':selected_region_geoj, 'filtered_region_geoj':filtered_region_geoj})

#### Tree Inventory task ####

@app.route('/inventoryyear', methods=['GET'])
def inventoryyear():
    inventoryyear_querystring = """ PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
        select distinct  ?year
        where { 
	    ?sanpshot a fio:OrganismSnapshot;
           fio:snapshotDate ?year
        }  order by ASC(?year)"""
    
    sparql_endpoint.setQuery(inventoryyear_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    inventoryyearresults = sparql_endpoint.query().convert()
    
    start_years = []
    for result in inventoryyearresults["results"]["bindings"]:
        year = result["year"]["value"]
        start_years.append(year)

    #return jsonify({'inventoryyearlisthtml':render_template('treeInventoryTaskloops.html', year_list=inventoryyear_list)})
    return jsonify({'startYears': start_years})

@app.route('/get_end_years', methods=['POST'])
def get_end_years():
    
    start_year = request.form.get('startYear')
    start_year = int(start_year)

    inventoryyear_querystring = f"""PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
    SELECT DISTINCT ?year
    WHERE {{ 
        ?snapshot a fio:OrganismSnapshot;
                 fio:snapshotDate ?year .
        FILTER(?year >= "{start_year}"^^xsd:gYear)
    }}  
    ORDER BY ASC(?year)"""
    
    sparql_endpoint.setQuery(inventoryyear_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    inventoryyearresults = sparql_endpoint.query().convert()
    
    end_years = []
    for result in inventoryyearresults["results"]["bindings"]:
        year = result["year"]["value"]
        end_years.append(year)

    print(inventoryyear_querystring)
    print(end_years)

    return jsonify({'endYears': end_years})

@app.route('/family', methods=['GET', 'POST'])
def family():

    clade = request.form.get("clade")

    family_querystring = """ PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX obo: <http://purl.obolibrary.org/obo/>
    PREFIX ncbitaxon: <http://purl.obolibrary.org/obo/ncbitaxon#>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    select distinct (SAMPLE(?coname) AS ?cname) (SAMPLE(?scname) AS ?sname) 
    where{
    ?fam rdfs:subClassOf obo:%s;
         ncbitaxon:has_rank obo:NCBITaxon_family;
         oboInOwl:hasExactSynonym ?coname;
         rdfs:label ?scname.
    }groupby ?fam order by ASC(?cname)""" % clade
    
    sparql_endpoint.setQuery(family_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    familyresults = sparql_endpoint.query().convert()
    
    family_list = []
    for result in familyresults["results"]["bindings"]:
        cname = result["cname"]["value"]
        sname = result["sname"]["value"]
        family_list.append([cname, sname])

    return jsonify({'familylisthtml':render_template('treeInventoryTaskloops.html', family_list=family_list)})

@app.route('/genus', methods=['GET', 'POST'])
def genus():

    famname = request.form.get("famname")
    clade = request.form.get("clade")

    genus_querystring = """ PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX obo: <http://purl.obolibrary.org/obo/>
    PREFIX ncbitaxon: <http://purl.obolibrary.org/obo/ncbitaxon#>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    select distinct (SAMPLE(?coname) AS ?cname) (SAMPLE(?scname) AS ?sname)
    where{
    ?genus rdfs:subClassOf [oboInOwl:hasExactSynonym "%s"].
    ?genus ncbitaxon:has_rank obo:NCBITaxon_genus;
         oboInOwl:hasExactSynonym ?coname;
         rdfs:label ?scname.
    }groupby ?genus order by ASC(?cname) """ % famname
    
    sparql_endpoint.setQuery(genus_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    genusresults = sparql_endpoint.query().convert()
    
    genus_list = []
    for result in genusresults["results"]["bindings"]:
        cname = result["cname"]["value"]
        sname = result["sname"]["value"]
        genus_list.append([cname, sname])

    return jsonify({'genuslisthtml':render_template('treeInventoryTaskloops.html', genus_list=genus_list)})

@app.route('/species', methods=['GET', 'POST'])
def species():

    genname = request.form.get("genname")
    clade = request.form.get("clade")

    species_querystring = """ PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX obo: <http://purl.obolibrary.org/obo/>
    PREFIX ncbitaxon: <http://purl.obolibrary.org/obo/ncbitaxon#>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    select distinct (SAMPLE(?coname) AS ?cname) (SAMPLE(?scname) AS ?sname)
    where{
    ?spe rdfs:subClassOf [oboInOwl:hasExactSynonym "%s"].
    ?spe ncbitaxon:has_rank obo:NCBITaxon_species;
         oboInOwl:hasExactSynonym ?coname;
         rdfs:label ?scname.
    }groupby ?spe order by ASC(?cname) """ % genname
    
    sparql_endpoint.setQuery(species_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    speciesresults = sparql_endpoint.query().convert()
    
    species_list = []
    for result in speciesresults["results"]["bindings"]:
        cname = result["cname"]["value"]
        sname = result["sname"]["value"]
        species_list.append([cname, sname])

    return jsonify({'specieslisthtml':render_template('treeInventoryTaskloops.html', species_list=species_list)})

@app.route('/treeclassmap', methods=['POST'])
def treeclassmap():
    
    year = request.form.get("year")
    cname = request.form.get("cname")
    selectedmetric = request.form.get('selectedmetric')
    selected_env_prop = request.form.get("env_prop")

    print(year, cname, selectedmetric)

    userparadata = {}
    userparadata['dbhrange'] = request.form.getlist("dbhrange")
    userparadata['tahrange'] = request.form.getlist("tahrange")
    userparadata['tthrange'] = request.form.getlist("tthrange")
    userparadata['selts'] = request.form.getlist("selts")

    processeddata = {}
    for key, value in userparadata.items():
        if value:
            processeddata[key] = value

    namespace = """PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX obo: <http://purl.obolibrary.org/obo/>
    PREFIX ncbitaxon: <http://purl.obolibrary.org/obo/ncbitaxon#>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
    PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
    PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
    PREFIX qudt: <http://qudt.org/schema/qudt/>"""

    
    if selectedmetric == "presenceAbsence":
        selectquery = f"""
        SELECT ?plot ?lat ?lon (COUNT(DISTINCT ?tree) AS ?treecount)
        WHERE {{ 
            ?plt a dfds:FIAPlot ;
                 rdfs:label ?plot ;
                 dfds:centroidlatitude ?lat ;
                 dfds:centroidlongitude ?lon .

            ?tree a [ oboInOwl:hasExactSynonym ?cname ] ;
                  fio:locatedIn ?plt .

            ?snapshot fio:snapshotOf ?tree ;
                      fio:snapshotDate ?year .

            FILTER (?cname = "{cname}" && ?year = "{year}"^^xsd:gYear)
        """

        endquery = "}groupby ?plot ?lat ?lon"

    elif selectedmetric == "abundance":
        selectquery = f"""
        SELECT ?plot ?lat ?lon (ROUND((?seltreecount / ?alltreecount) * 100) / 100.0 AS ?treecount)
        WHERE {{ 
            ?plt a dfds:FIAPlot ;
                 rdfs:label ?plot ;
                 dfds:centroidlatitude ?lat ;
                 dfds:centroidlongitude ?lon .

            {{
                SELECT ?plt (COUNT(DISTINCT ?seltree) AS ?seltreecount)
                WHERE {{
                    ?seltree a [ oboInOwl:hasExactSynonym ?cname ] ;
                             fio:locatedIn ?plt .
                    ?snapshot fio:snapshotOf ?seltree ;
                              fio:snapshotDate ?year .
                    FILTER(?cname = "{cname}" && ?year = "{year}"^^xsd:gYear)
                }}
                GROUP BY ?plt
            }}

            {{
                SELECT ?plt (COUNT(DISTINCT ?alltree) AS ?alltreecount)
                WHERE {{
                    ?alltree fio:locatedIn ?plt .
                    ?tsnapshot fio:snapshotOf ?alltree ;
                               fio:snapshotDate ?year .
                    FILTER(?year = "{year}"^^xsd:gYear)
                }}
                GROUP BY ?plt
            }}
        """

        endquery = "}"

    queryString = namespace + "\n" + selectquery

    if 'selts' in processeddata:
        sel_ts = processeddata['selts']
        sel_ts_value = "'" + "','".join(map(str, sel_ts)) + "'"
        ts_query = """?snapshot fio:includeRecord ?tsrecord.
                            ?tsrecord stad:hasQualityKind dfds:TreeStatus;
            		                stad:hasQualitativeValue ?classvalue.
                            ?classvalue rdfs:label ?tsclass.
        FILTER (?tsclass IN (%s) )""" % sel_ts_value

        queryString = queryString + "\n" + ts_query 

    if 'dbhrange' in processeddata:
        sel_dbh = processeddata['dbhrange']
        dbh_query = """?snapshot fio:includeRecord ?dbhrecord.
                       ?dbhrecord stad:hasQualityKind dfds:TreeDiameterAtBreastHeight;
            		           stad:hasQuantitativeValue[qudt:numericValue ?dbh].
                        FILTER (?dbh >= %s && ?dbh <= %s && ?dbh != "NaN"^^xsd:float)""" %(sel_dbh[0], sel_dbh[1])

        queryString = queryString + "\n" + dbh_query

    if 'tahrange' in processeddata:
        sel_tah = processeddata['tahrange']
        tah_query = """?snapshot fio:includeRecord ?tahrecord.
                       ?tahrecord stad:hasQualityKind dfds:TreeActualHeight;
            		           stad:hasQuantitativeValue[qudt:numericValue ?tah].
                        FILTER (?tah >= %s && ?tah <= %s && ?tah != "NaN"^^xsd:float)""" %(sel_tah[0], sel_tah[1])

        queryString = queryString + "\n" + tah_query

    if 'tthrange' in processeddata:
        sel_tth = processeddata['tthrange']
        tth_query = """?snapshot fio:includeRecord ?tthrecord.
                       ?tthrecord stad:hasQualityKind dfds:TreeTotalHeight;
            		           stad:hasQuantitativeValue[qudt:numericValue ?tth].
                        FILTER (?tth >= %s && ?tth <= %s && ?tth != "NaN"^^xsd:float)""" %(sel_tth[0], sel_tth[1])

        queryString = queryString + "\n" + tth_query

    queryString = queryString + "\n" + endquery

    sparql_endpoint.setQuery(queryString)

    print(queryString)

    sparql_endpoint.setReturnFormat(JSON)
    results = sparql_endpoint.query().convert()

    items = ["plot", "lat", "lon", "treecount"]
    res = {}

    for item in items:
        res[item] = []
    
    for result in results["results"]["bindings"]:
        for item in items:
            res[item].append(result[item]["value"])

    results_table = pd.DataFrame.from_dict(res, orient="index").transpose()
    results_table['treecount'] = results_table['treecount'].astype(float)
    results_table['lat'] = results_table['lat'].astype(float)
    results_table['lon'] = results_table['lon'].astype(float)

    # Create a GeoDataFrame from the DataFrame, specifying geometry and CRS
    gdf = gpd.GeoDataFrame(
        results_table,
        geometry=gpd.points_from_xy(results_table.lon, results_table.lat),
        crs="EPSG:4326"
    )

    # Convert the GeoDataFrame to a GeoJSON-like dictionary
    treedata = gdf.__geo_interface__

    categorical_prop = ["DominantAspectClass", "DominantSoilDrainageClass", "GeneralizedLithology", "GeneralizedLandCover"]
    
    if selected_env_prop:
        if selected_env_prop in categorical_prop:
    
            env_select_query = f"""select ?cellID ?geom ?prop
            where{{
            ?region rdf:type dfds:S2Cell_level13;
                dfds:cellID ?cellID;
                geo:hasGeometry [geo:asWKT ?geom].
            [] a dfds:{selected_env_prop};
                stad:hasSpatialCoverage ?region;
                stad:hasQualitativeValue [rdfs:label ?prop].}}"""

        else:
            env_select_query = f"""select ?cellID ?geom ?prop
            where{{
            ?region rdf:type dfds:S2Cell_level13;
                dfds:cellID ?cellID;
                geo:hasGeometry [geo:asWKT ?geom].
            [] a dfds:{selected_env_prop};
	    stad:hasSpatialCoverage ?region;
        stad:hasQuantitativeValue [qudt:numericValue ?prop].}}"""

        name_space_query = """PREFIX stad: <http://purl.org/spatialai/stad/v2/core/> 
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX time: <http://www.w3.org/2006/time#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>  
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
        PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>"""


        env_query = name_space_query + "\n" + env_select_query
    
        sparql_endpoint.setQuery(env_query)

        sparql_endpoint.setReturnFormat(JSON)
        selected_region_results = sparql_endpoint.query().convert()
        selected_region_dic = {}
        selected_region_dic['cellID'] = []
        selected_region_dic['geometry'] = []
        selected_region_dic['prop'] = []
        
        for result in selected_region_results["results"]["bindings"]:
            selected_region_dic['geometry'].append(result['geom']["value"].split('>')[1])
            selected_region_dic['cellID'].append(result["cellID"]["value"])
            selected_region_dic['prop'].append(result["prop"]["value"])

        region_table = pd.DataFrame.from_dict(selected_region_dic)
        region_table['geometry'] = region_table['geometry'].apply(wkt.loads)
        region_gdf = gpd.GeoDataFrame(region_table, crs='EPSG:4326')
    
        region_geoj = region_gdf.__geo_interface__
    else:
        region_goej = []
    
    # Return the GeoJSON as a JSON response
    return jsonify({'treedata': treedata, "envdata":region_geoj})


@app.route('/minmaxtree', methods=['GET', 'POST'])
def minmaxtree():
    """
    Checks for minimum and maximum values of quantities and use them as constraints for sliders
    to guide user selection
    """
    year = request.form.get("year")
    cname = request.form.get("cname")
    quality = request.form.get("quality")

    name_space = """PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
    PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
    PREFIX qudt: <http://qudt.org/schema/qudt/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>"""
    
    end_query = "}"

    select_query = f"""SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
    WHERE {{ 
        ?tree a [ oboInOwl:hasExactSynonym ?cname ] .
        ?snapshot fio:snapshotOf ?tree ;
                  fio:snapshotDate ?year ;
        		fio:includeRecord ?record.
            ?record stad:hasQualityKind dfds:{quality};
            		stad:hasQuantitativeValue[qudt:numericValue ?val].
        FILTER (?cname = "{cname}" && ?year = "{year}"^^xsd:gYear)
        FILTER(ISNUMERIC(?val)&& ?val != "NaN"^^xsd:float)
    }}"""    
    
    minmax_querystring = name_space + "\n" + select_query

    sparql_endpoint.setQuery(minmax_querystring)
    sparql_endpoint.setReturnFormat(JSON)
    minmaxresults = sparql_endpoint.query().convert()
    for result in minmaxresults["results"]["bindings"]:
        datamax = result["datamax"]["value"]
        datamin = result["datamin"]["value"]

    return jsonify({'datamin':datamin, 'datamax':datamax})

@app.route('/categorygrouptree', methods=['GET', 'POST'])
def categorygrouptree():

    """
    Checks for actual categorical values in the graph use to constraint user selection
    """
    
    year = request.form.get("year")
    cname = request.form.get("cname")
    quality = request.form.get("quality")

    name_space = """PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
    PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
    PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>"""
    
    select_query = f"""
    SELECT DISTINCT ?class
    WHERE {{
        ?tree a [ oboInOwl:hasExactSynonym ?cname ] .
        ?snapshot fio:snapshotOf ?tree ;
                  fio:snapshotDate ?year ;
                  fio:includeRecord ?record .
        
        ?record stad:hasQualityKind dfds:{quality} ;
                stad:hasQualitativeValue ?classvalue .
        
        ?classvalue rdfs:label ?class .
        
        FILTER (?cname = "{cname}" && ?year = "{year}"^^xsd:gYear)
    }}"""
        
    category_querystring = name_space + "\n" + select_query
    
    sparql_endpoint.setQuery(category_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    categoryresults = sparql_endpoint.query().convert()
    
    class_list = []
    for result in categoryresults["results"]["bindings"]:
        class_ = result["class"]["value"]
        class_list.append(class_)

    return jsonify({'classlisthtml':render_template('treeInventoryTaskLoops.html', class_list=class_list)})

@app.route('/minmaxtreeenv', methods=['GET', 'POST'])
def minmaxtreeenv():
    """
    Checks for minimum and maximum values of quantities and use them as constraints for sliders
    to guide user selection
    """
    quality = request.form.get("quality")

    name_space = """PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
        PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>"""

    select_query = f"""
    SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
    WHERE {{
        ?amt a dfds:{quality};
            stad:hasQuantitativeValue [qudt:numericValue ?val].
        ?amt stad:hasSpatialCoverage ?region.
        ?region rdf:type dfds:S2Cell_level13.
        }}"""
        
    
    minmax_querystring = name_space + "\n" + select_query

    sparql_endpoint.setQuery(minmax_querystring)
    sparql_endpoint.setReturnFormat(JSON)
    minmaxresults = sparql_endpoint.query().convert()
    for result in minmaxresults["results"]["bindings"]:
        datamax = result["datamax"]["value"]
        datamin = result["datamin"]["value"]

    return jsonify({'datamin':datamin, 'datamax':datamax})

@app.route('/categorygrouptreeenv', methods=['GET', 'POST'])
def categorygrouptreeenv():

    """
    Checks for actual categorical values in the graph use to constraint user selection
    """
    
    quality = request.form.get("quality")

    name_space = """PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
        PREFIX qudt: <http://qudt.org/schema/qudt/>
        PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
        PREFIX fio: <http://purl.org/spatialai/fio/v1/core/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>"""
    
    select_query = f"""SELECT DISTINCT ?class
        WHERE {{
            ?prop a dfds:{quality};
                stad:hasQualitativeValue ?classvalue.
            ?classvalue rdfs:label ?class.
            ?prop stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:S2Cell_level13.
        }}"""

    category_querystring = name_space + "\n" + select_query
    
    sparql_endpoint.setQuery(category_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    categoryresults = sparql_endpoint.query().convert()
    
    class_list = []
    for result in categoryresults["results"]["bindings"]:
        class_ = result["class"]["value"]
        class_list.append(class_)

    return jsonify({'classlisthtml':render_template('itemList.html', class_list=class_list)})

##### Preferences ######

@app.route('/treeswithpreferences', methods=['GET', 'POST'])
def treeswithpreferences():

    trees_querystring = """PREFIX epo: <http://purl.org/spatialai/prefenvo/v1/core/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
    PREFIX obo: <http://purl.obolibrary.org/obo/>
    PREFIX ncbitaxon: <http://purl.obolibrary.org/obo/ncbitaxon#>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    
    select distinct (SAMPLE(?coname) AS ?cname)
    where{
    ?spe ncbitaxon:has_rank obo:NCBITaxon_species;
         oboInOwl:hasExactSynonym ?coname.
    ?spe rdfs:subClassOf [owl:onProperty epo:hasEnvironmentalPreferenceSet; owl:hasValue ?envprefset]} groupby ?spe"""
    
    sparql_endpoint.setQuery(trees_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    treesresults = sparql_endpoint.query().convert()
    
    trees_list = []
    for result in treesresults["results"]["bindings"]:
        tree_name = result["cname"]["value"]
        tree_id = tree_name.replace(" ", "")
        trees_list.append([tree_name, tree_id])

    return jsonify({'treeslisthtml':render_template('preferencesTaskloop.html', trees_list=trees_list)})
 

@app.route('/treepreferences', methods=['GET', 'POST'])
def treepreferences():

    selectedtree = request.form.get("selectedtree")

    treepref_querystring = """ PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX epo: <http://purl.org/spatialai/prefenvo/v1/core/>
    PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/>
    PREFIX qudt: <http://qudt.org/schema/qudt/>
    PREFIX oboInOwl: <http://www.geneontology.org/formats/oboInOwl#>
    PREFIX stad: <http://purl.org/spatialai/stad/v2/core/>
    
    select distinct ?qualitykind ?minimumpreference ?maximumpreference ?rank
    where { 
        ?spec rdfs:subClassOf [owl:onProperty epo:hasEnvironmentalPreferenceSet; owl:hasValue ?envprefset].
        ?spec oboInOwl:hasExactSynonym ?tree.
        ?envprefset epo:containsPreference ?envpref.
    ?envpref stad:hasQualityKind [rdfs:label ?qualitykind].
    ?envpref epo:hasPreferenceDescription ?range;
             epo:hasPredictorImportance ?predimp.
        ?range epo:minimumPreference [qudt:numericValue ?minimumpreference];
               epo:maximumPreference [qudt:numericValue ?maximumpreference].
        ?predimp epo:hasImportanceRank [rdfs:label ?rank].
        
        filter(?tree = "%s")} """ % selectedtree
    
    sparql_endpoint.setQuery(treepref_querystring)

    sparql_endpoint.setReturnFormat(JSON)
    treeprefresults = sparql_endpoint.query().convert()
    
    treepref_dict = {}
    treepref_dict['variable'] = []
    treepref_dict['minimum'] = []
    treepref_dict['maximum'] = []
    treepref_dict['rank'] = []
    
    for result in treeprefresults["results"]["bindings"]:
       treepref_dict['variable'].append(result["qualitykind"]["value"])
       treepref_dict['minimum'].append(result["minimumpreference"]["value"])
       treepref_dict['maximum'].append(result["maximumpreference"]["value"])
       treepref_dict['rank'].append(result["rank"]["value"])

    pref_data = json.dumps(treepref_dict)

    return jsonify({"pref_data":pref_data})

@app.route('/feasibiltycheck', methods=['POST'])
def feasibiltycheck():

    data = request.json

    tolerance_range_table = pd.DataFrame.from_dict(data)

    tolerance_range_table['prop'] = tolerance_range_table.variable.str.replace(" ", "")

    tolerance_range_table2 = tolerance_range_table.set_index('prop')

    name_space = """PREFIX stadqv: <http://spatialai.org/stad/qualityvalue/> 
    PREFIX stad: <http://purl.org/spatialai/stad/v2/core/> 
    PREFIX qudt: <http://qudt.org/schema/qudt/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX time: <http://www.w3.org/2006/time#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX dfds: <http://spatialai.org/digitalforest/datasets/core/> 
    PREFIX geof: <http://www.opengis.net/def/function/geosparql/>"""

    begin_query = """select*
        where{
        ?region rdf:type dfds:S2Cell_level13;
            dfds:cellID ?cellID;
            geo:hasGeometry [geo:asWKT ?geom]."""
    
    end_query = "}"

    query_string = name_space + "\n" + begin_query

    column_names = []
    variable_desc = []

    for index, row in tolerance_range_table.iterrows():
        select_query = ''' [] stad:hasQualityKind [rdfs:label "%s"];
                               stad:hasQuantitativeValue [qudt:numericValue ?%s];
                               stad:hasSpatialCoverage ?region.''' %(row['variable'], row['prop'])

        query_string = query_string + "\n" + select_query

        column_names.append(row['prop'])
        variable_desc.append(row['variable'])

    query_string = query_string + "\n" + end_query

    sparql_endpoint.setQuery(query_string)
    sparql_endpoint.setReturnFormat(JSON)
    results = sparql_endpoint.query().convert()

    data_dic = {}
    data_dic['cellID'] = []
    data_dic['geometry'] = []
    for col_name in column_names:
        data_dic[col_name] = []
        
    for result in results["results"]["bindings"]:
        data_dic['geometry'].append(result['geom']["value"].split('>')[1])
        data_dic['cellID'].append(result["cellID"]["value"])
        for col_name in column_names:
            data_dic[col_name].append(result[col_name]["value"])

    data_table = pd.DataFrame.from_dict(data_dic)
    data_table['geometry'] = data_table['geometry'].apply(wkt.loads)
    data_gdf = gpd.GeoDataFrame(data_table, crs='EPSG:4326')

    for index, roww in tolerance_range_table2.iterrows():
       variable = (tolerance_range_table2.loc[[index], ['variable']]).values[0][0]
       lower = float((tolerance_range_table2.loc[[index], ['min']]).values[0][0])
       upper = float((tolerance_range_table2.loc[[index], ['max']]).values[0][0])
       data_gdf[index] = data_gdf[index].astype(float)
       data_gdf[variable] = data_gdf.apply(lambda row: range_check(row, index, lower, upper), axis=1)

    data_gdf['feasibility'] = (data_gdf[variable_desc].sum(axis=1))/len(variable_desc)
    data_gdf['feasibility'] = data_gdf['feasibility'].astype(float)
    feasibility_data = data_gdf.to_json()

    return jsonify({'feasibility_data':feasibility_data})

'''
    colormap = branca.colormap.LinearColormap(
        vmin=data_gdf['feasibility'].quantile(0.0),
        vmax=data_gdf['feasibility'].quantile(1),
        colors=["red", "orange", "lightblue", "green", "darkgreen"],
        caption="Feasibility",
    )

    base_map = folium.Map(location=[45, -69], zoom_start=7,tiles='openstreetmap')

    tooltip = folium.GeoJsonTooltip(
        fields=variable_desc,
        aliases=variable_desc,
        localize=True,
        sticky=False,
        labels=True,
        style="""
            background-color: #F0EFEF;
            border: 2px solid black;
            border-radius: 3px;
            box-shadow: 3px;
        """,
        max_width=800,
    )

    g = folium.GeoJson(data_gdf,
        style_function=lambda x: {
            "fillColor": colormap(x["properties"]["feasibility"])
            if x["properties"]["feasibility"] is not None
            else "transparent",
            "color": "",
            "fillOpacity": 0.8,
            "weight": 0.01,
            "line_opacity":0.1,
        },
        tooltip=tooltip,
    ).add_to(base_map)

    colormap.add_to(base_map)

    html_map = base_map._repr_html_()

    return jsonify({'html_map':html_map})
'''
if __name__ == '__main__':
    app.run(debug=True)