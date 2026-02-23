jQuery(document).ready(function () {

    $(".layer-filters").hide();
    $("#environmentalfilters").hide();
    $('.slider').hide();
    $('.classgroup').hide();
    
    /* For spinner */
    $('#environmental-spinner').hide();
    $(document).ajaxStop(function () {
        $('#environmental-spinner').hide();
    });
    $(document).ajaxStart(function () {
        $('#environmental-spinner').show();
    });

    /*
    var map = new ol.Map({
        layers: [
            new ol.layer.Tile({
            source: new ol.source.OSM()
            })
        ],
        target: 'visElement',
        view: new ol.View({
            center: ol.proj.transform([43.979433, -72.809594], 'EPSG:4326', 'EPSG:3857'),
            zoom: 7
        })
    });
    */

    //var useGeographic = new ol.proj.useGeographic();
    /*
    var map = new ol.Map({
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM(),
            }),
        ],
        target: 'visElement',
        view: new ol.View({
            center: ol.proj.fromLonLat([-72.809594, 43.979433]),
            zoom: 7,
        }),
    });

    var vectorLayers = {};
    var dpi = 72;

    function mapScale() {
        var unit = map.getView().getProjection().getUnits();
        var resolution = map.getView().getResolution();
        var inchesPerMetre = 39.37;

        return resolution * map.getView().getProjection().getMetersPerUnit() * inchesPerMetre * dpi;
    }

    var layerStyles = function (feature, resolution) {
        if (mapScale() < 1000000) {
            return [
                new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#000000', width: 6.000000 }) }),
                new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#FFFF00', width: 2.000000 }) }),
                new ol.style.Style({ text: new ol.style.Text({ text: feature.get('label')['1000000'], font: ' 20pt sans-serif', fill: new ol.style.Fill({ color: '#FFFF00' }), stroke: new ol.style.Stroke({ color: '#000000', width: 4.0 }), offsetX: 14, textAlign: 'start', textBaseline: 'alphabetic' }) })
            ]
        }
    };


    function addVectorLayer(jsondata, layerIndex, layerProj, styles) {
        //	var geoJSONFormat = new ol.format.GeoJSON({defaultDataProjection: layerProj});
        var mp = new ol.Map({
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.OSM(),
                }),
            ],
            target: 'visElement',
            view: new ol.View({
                center: ol.proj.fromLonLat([-72.809594, 43.979433]),
                zoom: 7,
            }),
        });
        var geoJSONFormat = new ol.format.GeoJSON({ dataProjection: layerProj });
        var newLayer = new ol.layer.Vector({
            style: styles,
            source: new ol.source.Vector({
                strategy: ol.loadingstrategy.bbox,
                loader: function (extent, resolution, proj) {
                    var convertedExtent = ol.proj.transformExtent(extent, proj, layerProj);
                    var vectorSource = this
                    //				var promise = jsonPromise(layerIndex, convertedExtent)
                    //				promise.then(function(jsonString, errorString) {
                    //					if ( jsonString ) {
                    jsonString = jsondata;
                    var features = [];
                    try {
                        features = geoJSONFormat.readFeatures(jsonString, {
                            featureProjection: proj,
                        });
                        if (features.length) {
                            vectorSource.addFeatures(features);
                            console.log("ADDED FEATURES FROM PROMISED JSON: " + jsonString)
                        }
                    } catch (err) {
                        console.log("Failed to add features from JSON:");
                        console.log(jsonString);
                        console.log(err);
                    }
                    //					} else if ( errorString ) {
                    //						console.log(errorString)
                    //					}
                    //				}, function(err) {
                    //					console.log(err)
                    //				});
                },
            }),
        });
        vectorLayers[layerIndex] = newLayer;  //  NB:  Integer is automatically converted to string here for dictionary indexing

        mp.addLayer(newLayer);

        return newLayer;
    }

    function redrawLayer(layer) {
        console.log("REDRAWING LAYER");
        //    layer.getSource().clear(true);
        //    layer.getSource().changed();
        layer.getSource().refresh();
    }

    */

    // Function to transform coordinates from EPSG:3857 to EPSG:4326
    function transformCoordinates(coordinates) {
        return ol.proj.transform(coordinates, 'EPSG:3857', 'EPSG:4326');
    }

    // Function to convert transformed coordinates to WKT format
    function convertPolygonToWKT(coordinates) {
        var format = new ol.format.WKT();
        var polygon = new ol.geom.Polygon([coordinates]);
        return format.writeGeometry(polygon);
    }

    var map;

    function createmaplegend() {
        // Color legend
        const legendHtml = `
                <div class="map-legend" id="map-legend">
                    <div>
                    <h5>Map Legend</h5>
                    <div><span style="background-color:orange; width:20px; height:10px; display:inline-block;"></span> Selected criteria satisfied </div>
                    <div><span style="background-color:blue; width:20px; height:10px; display:inline-block;"></span> Selected criteria not statisfied </div>
                    </div>
                </div >`;
        $('#visElement').append(legendHtml);
    }

    // Initialize the map
    function initMap() {
        map = new ol.Map({
            target: 'visElement',
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.OSM()
                }),
                new ol.layer.Vector({
                    source: new ol.source.Vector()
                })
            ],
            view: new ol.View({
                center: [-72.809594, 43.979433],
                zoom: 7,
                projection: 'EPSG:4326'
            })
        });
    }

    // Initialize the map
    initMap();

    var draw; // Declare draw globally

    // Function to start drawing on the map
    function startDrawing() {
        //Remove existing draw interaction if any
        map.getInteractions().forEach(function (interaction) {
            if (interaction instanceof ol.interaction.Draw) {
                map.removeInteraction(interaction);
            }
        });

        // Create a new vector source if not already created
        // Get the empty vector layer (layer 1) that was created in initMap
        var vectorLayer = map.getLayers().getArray()[1];
        var source = vectorLayer.getSource();

        // Create a new draw interaction
        draw = new ol.interaction.Draw({
            source: source,
            type: 'Polygon' // Allow users to draw polygons
        });

        // Add the draw interaction to the map
        map.addInteraction(draw);

        // Event listener to handle drawing completion
        draw.once('drawend', function (event) {
            var feature = event.feature;
            var geom = feature.getGeometry();
            var format = new ol.format.WKT();
            wkt = format.writeGeometry(geom)
            console.log(wkt);

            // Disable draw interaction
            draw.setActive(false);

            // Show environmental filters
            $("#environmentalfilters").show()

            // Disable spatial filters
            $('input[name=spatialfilterradio]').attr("disabled", true);
        });
    }

    // Event listener for the draw button click
    $('#drawonmap').change(function () {
        if ($(this).is(':checked')) {
            startDrawing();
            $(".layer-filters").hide();
        }
    });

    jQuery.propHooks.checked = {
        set: function (el, value) {
            if (el.checked !== value) {
                el.checked = value;
                $(el).trigger('change');
            }
        }
    };

    $('.contains-items').on('change', 'input[type=checkbox]', function () {
        // if is checked
        if (this.checked) {
            // check all children
            var lenchk = $(this).closest('ul').find(':checkbox');
            var lenchkChecked = $(this).closest('ul').find(':checkbox:checked');

            //if all siblings are checked, check its parent checkbox
            if (lenchk.length == lenchkChecked.length) {
                $(this).closest('ul').siblings().find(':checkbox').prop('checked', true);
            } else {
                $(this).closest('.checkbox').siblings().find(':checkbox').prop('checked', true);
            }
        } else {
            // uncheck all children
            $(this).closest('.checkbox').siblings().find(':checkbox').prop('checked', false);
            $(this).closest('ul').siblings().find(':checkbox').prop('checked', false);
        }
    });

    // check if at least one county checkbox is checked
    $('.cntychkbox').change(function () {
        // Get the number of checked checkboxes
        var numChecked = $('.cntychkbox:checked').length;

        // Enable or disable the button based on the number of checked checkboxes
        if (numChecked > 0) {
            $('#applyspatialfilters').prop('disabled', false);
        } else {
            $('#applyspatialfilters').prop('disabled', true);
        }
    });

    // check if at least one environmental variable is checked
    $('.environvariablechkbox').change(function () {
        // Get the number of checked checkboxes
        var numChecked = $('.environvariablechkbox:checked').length;

        // Enable or disable the button based on the number of checked checkboxes
        if (numChecked > 0) {
            $('#submituserinput').prop('disabled', false);
        } else {
            $('#submituserinput').prop('disabled', true);
        }
    });

    $(".spatial-filters .countycheckbox").on('change', 'input[type=checkbox]', function () {

        selectedregion = [];

        $('.spatial-filters .countycheckbox input:checked').each(function () {
            selectedregion.push($(this).attr('value'));
        });
        console.log(selectedregion);
    })


    $('.slidercheckbox').on('change', function () {
        var requestdata = {}
        requestdata.quality = $(this).attr('value');

        if ($('#drawonmap').is(':checked')) {
            requestdata.wkt = wkt;
        } else if ($('#adminboundaries').is(':checked')) {
            requestdata.selectedregion = selectedregion;
        };

        // Select the second div using a proper selector
        var sliderlist = $(this).parent().find('.slider');
        var sliderDiv = sliderlist[0]

        if ($(this).is(':checked')) {
            // If checkbox is checked, create the slider
            noUiSlider.create(sliderDiv, {
                start: [0, 10],
                tooltips: true,
                step: 0.1,
                connect: true,
                range: {
                    'min': 0,
                    'max': 10
                }
            });

            $.ajax({
                type: 'POST',
                data: requestdata,
                url: '/minmax',
                traditional: true,
                success: function (data) {
                    var min = Number(data.datamin);
                    var max = Number(data.datamax)
                    sliderDiv.noUiSlider.updateOptions({
                        range: {
                            'min': min,
                            'max': max
                        },
                    });
                    sliderDiv.noUiSlider.set([min, max])
                    $(sliderDiv).show(); // Show the slider div
                }
            });
        } else {
            // If checkbox is unchecked, hide the slider div
            $(sliderDiv).hide();
        }
    });

    $('.classgroupcheckbox').on('change', function () {

        var requestdata = {}
        requestdata.quality = $(this).attr('value');

        if ($('#drawonmap').is(':checked')) {
            requestdata.wkt = wkt;
        } else if ($('#adminboundaries').is(':checked')) {
            requestdata.selectedregion = selectedregion;
        };

        // Select the second div using a proper selector
        var categorygrouplist = $(this).parent().find('.classgroup');
        var categorygroupDiv = categorygrouplist[0]

        if ($(this).is(':checked')) {
            $.ajax({
                type: 'POST',
                data: requestdata,
                url: '/categorygroup',
                traditional: true,
                success: function (data) {
                    $(categorygroupDiv).empty();
                    $(categorygroupDiv).append(data.classlisthtml)
                    $(categorygroupDiv).show()
                }

            });
        } else {
            $(categorygroupDiv).hide();
        }
    });
    
    function uncheckAll(divid) {
        $('#' + divid + ' input[type="checkbox"]').prop('checked', false);
    }

    $('#adminboundaries').change(function () {
        if ($(this).is(':checked')) {
            $(".layer-filters").show()
            $("#environmentalfilters").hide();
        } else {
            $(".layer-filters").hide()
        }
    });

    $('#applyspatialfilters').click(function () {;
        $(".layer-filters").hide()
        $("#environmentalfilters").show();
        $('input[name=spatialfilterradio]').attr("disabled", true);
        uncheckAll('environmentalfilters');

        
    });
    
    var html_table
    var jsn_table

    function fetchDataFromServer(searchParams) {
        // Send AJAX request
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: '/userpara',
                data: searchParams,
                type: 'POST',
                traditional: true,
                success: function (data) {
                    resolve(data)
                },
                error: function (error) {
                    reject(error)
                }
            });
        });
    }
    
    $("#submituserinput").click(function () {
        var requestData = {};

        // Helper function to get slider range if checkbox is checked
        function getSliderRange(checkbox, slider) {
            if (checkbox.is(':checked')) {
                return slider.noUiSlider.get(true);
            }
        }

        // Helper function to get selected values from checkbox groups
        function getSelectedValues(checkbox, group) {
            var selectedValues = [];
            if (checkbox.is(':checked')) {
                group.find('input:checked').each(function () {
                    selectedValues.push($(this).attr('name'));
                });
            }
            return selectedValues;
        }

        // Populate requestData object based on checkbox states
        requestData.matrange = getSliderRange($('#matcheckbox'), matslider);
        requestData.tavesmrange = getSliderRange($('#tavesmcheckbox'), tavesmslider);
        requestData.tavewtrange = getSliderRange($('#tavewtcheckbox'), tavewtslider);

        requestData.taveatrange = getSliderRange($('#taveatcheckbox'), taveatslider);
        
        requestData.tavesprange = getSliderRange($('#tavespcheckbox'), tavespslider);
        
        requestData.mcmtrange = getSliderRange($('#mcmtcheckbox'), mcmtslider);
        
        requestData.mwmtrange = getSliderRange($('#mwmtcheckbox'), mwmtslider);
        
        requestData.extrange = getSliderRange($('#extcheckbox'), extslider);
        
        requestData.emtrange = getSliderRange($('#emtcheckbox'), emtslider);
        
        requestData.maprange = getSliderRange($('#mapcheckbox'), mapslider);
        
        requestData.pptsmrange = getSliderRange($('#pptsmcheckbox'), pptsmslider);
        
        requestData.pptwtrange = getSliderRange($('#pptwtcheckbox'), pptwtslider);
        
        requestData.pptatrange = getSliderRange($('#pptatcheckbox'), pptatslider);
        
        requestData.pptsprange = getSliderRange($('#pptspcheckbox'), pptspslider);
        
        requestData.pasrange = getSliderRange($('#pascheckbox'), passlider);
        
        requestData.nffdrange = getSliderRange($('#nffdcheckbox'), nffdslider);
        
        requestData.rhrange = getSliderRange($('#rhcheckbox'), rhslider);
        
        requestData.minelevationrange = getSliderRange($('#minelevationcheckbox'), minelevationslider);
        
        requestData.maxelevationrange = getSliderRange($('#maxelevationcheckbox'), maxelevationslider);
        
        requestData.meanelevationrange = getSliderRange($('#meanelevationcheckbox'), meanelevationslider);
        
        requestData.meansloperange = getSliderRange($('#meanslopecheckbox'), meanslopeslider);
        
        requestData.aws150range = getSliderRange($('#aws150checkbox'), aws150slider);

        requestData.selaspect = getSelectedValues($('#aspectcheckbox'), $('#aspectgroup'));
        requestData.seldrainage = getSelectedValues($('#soildrcheckbox'), $('#drainagegroup'));
        requestData.sellit = getSelectedValues($('#lithologycheckbox'), $('#litgroup'));
        requestData.sellandcover = getSelectedValues($('#landcovercheckbox'), $('#landcovergroup'));
        

        // Determine whether to include additional parameters based on checkbox state
        if ($('#drawonmap').is(':checked')) {
            requestData.wkt = wkt;
        } else if ($('#adminboundaries').is(':checked')) {
            requestData.selectedregion = selectedregion;
        }

        fetchDataFromServer(requestData)
            .then(function (data) {
                console.log('Data fetched successfully:', data);

                selected_region = data.selected_region_geoj;
                filtered_region = data.filtered_region_geoj;

                console.log(selected_region)

                // Clear current map content
                $('#visElement').empty();

                // Initialize a new map view
                var new_map = new ol.Map({
                    target: 'visElement',
                    layers: [
                        new ol.layer.Tile({
                            source: new ol.source.OSM()
                        })
                    ],
                    view: new ol.View({
                        center: ol.proj.fromLonLat([-72.809594, 43.979433]), // Convert lon/lat to EPSG:3857
                        zoom: 7,
                        projection: 'EPSG:3857' // Use default projection for OpenLayers
                    })
                });

                // Create a vector source from selected region GeoJSON
                var vectorSource_selectedRegion = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(selected_region, {
                        dataProjection: 'EPSG:4326', // Assuming your data is in this projection
                        featureProjection: 'EPSG:3857' // OpenLayers uses this for map display
                    })
                });

                // Create a vector source from filtered region GeoJSON
                var vectorSource_filteredRegion = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(filtered_region, {
                        dataProjection: 'EPSG:4326', // Assuming your data is in this projection
                        featureProjection: 'EPSG:3857' // OpenLayers uses this for map display
                    })
                });

                // Define a style for the selected region polygons (orange)
                var Style_selectedRegion = new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 0, 255, 1)' // Blue fill color
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 1)', // Black stroke
                        width: 0.05
                    })
                });

                // Define a style for the filtered region polygons (red)
                var Style_filteredRegion = new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 125, 0, 1)' // Orange fill color
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 1)', // Black stroke
                        width: 0.05
                    })
                });

                // Vector layer for selected region
                var vectorLayer_selectedRegion = new ol.layer.Vector({
                    source: vectorSource_selectedRegion,
                    style: Style_selectedRegion
                });

                // Vector layer for filtered region
                var vectorLayer_filteredRegion = new ol.layer.Vector({
                    source: vectorSource_filteredRegion,
                    style: Style_filteredRegion
                });

                // Add the layers to the map
                new_map.addLayer(vectorLayer_selectedRegion);
                new_map.addLayer(vectorLayer_filteredRegion);

                $(".layer-filters").hide();
                createmaplegend();

            })
            .catch(function (error) {
                // Catch block to handle errors from any `.then()` in the chain
                console.error('Error occurred:', error);
            });
    });

});



