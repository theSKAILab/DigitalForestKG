name_space = """PREFIX dfds: <https://spatialai.org/digitalforest/datasets/core/>
        PREFIX qudt: <https://qudt.org/schema/qudt/>
        PREFIX stad: <https://purl.org/spatialai/stad/v2/core/>
        PREFIX fio: <https://purl.org/spatialai/fio/v1/core/>
        PREFIX rdf: <https://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <https://www.w3.org/2000/01/rdf-schema#>
        PREFIX geo: <https://www.opengis.net/ont/geosparql#>
        PREFIX geof: <https://www.opengis.net/def/function/geosparql/>"""
    
end_query = "}"

region_values = '"' + '"Kennebec"' + '"'
s2celltype = 'S2Cell_level13'
quality = "Mean Slope"

select_query = f"""SELECT (MAX(?val) AS ?datamax) (MIN(?val) AS ?datamin)
        WHERE {{VALUES ?county {{ {region_values} }}
            ?amt a dfds:{quality};
                stad:hasQuantitativeValue [qudt:numericValue ?val].
            ?amt stad:hasSpatialCoverage ?region.
            ?region rdf:type dfds:{s2celltype};
                fio:locatedIn [rdfs:label ?county].
        }}"""

minmax_querystring = name_space + "\n" + select_query

print( minmax_querystring )

