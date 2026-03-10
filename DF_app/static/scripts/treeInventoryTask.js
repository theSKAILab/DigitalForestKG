jQuery(document).ready(function () {


    /* For spinner */
    $('#inventory-spinner').hide();
    $(document).ajaxStop(function () {
        $('#inventory-spinner').hide();
    });

    $(document).ajaxStart(function () {
        $('#inventory-spinner').show();
    });

    var map;
    var dataLayerCount = 0; // Track data layers for easy removal

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
                center: ol.proj.fromLonLat([-72.809594, 43.979433]),
                zoom: 7,
                projection: 'EPSG:3857'
            })
        });
    }

    // Initialize the map
    initMap();

    // Function to load all areas (counties) on page load
    function loadAllAreas() {
        $.ajax({
            url: '/all_areas',
            type: 'GET',
            traditional: true,
            success: function (data) {
                console.log('All areas loaded:', data);
                
                var allAreasGeoJSON = data.all_areas_geoj;
                console.log('GeoJSON data:', allAreasGeoJSON);
                
                try {
                    // Parse GeoJSON if it's a string
                    var geoJSONObj = typeof allAreasGeoJSON === 'string' ? JSON.parse(allAreasGeoJSON) : allAreasGeoJSON;
                    console.log('Parsed GeoJSON:', geoJSONObj);
                    
                    // Create a vector source from all areas GeoJSON
                    var vectorSource_allAreas = new ol.source.Vector({
                        features: new ol.format.GeoJSON().readFeatures(geoJSONObj, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857'
                        })
                    });
                    
                    console.log('Number of features:', vectorSource_allAreas.getFeatures().length);

                    // Style function that uses the color property from each feature
                    var styleFunction = function(feature) {
                        var color = feature.get('color') || '#CCCCCC'; // Default gray if no color
                        var countyName = feature.get('COUNTY') || '';
                        
                        // Convert hex color to rgba with reduced opacity (40%)
                        var rgbaColor = hexToRgba(color, 0.4);
                        
                        return new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: rgbaColor
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#1a1a1a', // Darker black for borders
                                width: 2.5,
                                lineDash: [0] // Solid line
                            }),
                            text: new ol.style.Text({
                                text: countyName,
                                font: 'bold 12px Arial',
                                fill: new ol.style.Fill({
                                    color: '#FFFFFF'
                                }),
                                stroke: new ol.style.Stroke({
                                    color: '#1a1a1a',
                                    width: 4
                                }),
                                offsetY: 0,
                                overflow: false,
                                placement: 'point'
                            }),
                            zIndex: 1000
                        });
                    };

                    // Helper function to convert hex to rgba
                    var hexToRgba = function(hex, alpha) {
                        var r = parseInt(hex.slice(1, 3), 16);
                        var g = parseInt(hex.slice(3, 5), 16);
                        var b = parseInt(hex.slice(5, 7), 16);
                        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
                    };

                    // Vector layer for all areas
                    var vectorLayer_allAreas = new ol.layer.Vector({
                        source: vectorSource_allAreas,
                        style: styleFunction,
                        zIndex: 1000
                    });

                    // Add the layer to the map (add to bottom, after base layer)
                    map.addLayer(vectorLayer_allAreas);
                    console.log('All areas layer added to map');
                } catch (error) {
                    console.error('Error processing all areas data:', error);
                }
            },
            error: function (error) {
                console.error('Error loading all areas:', error);
            }
        });
    }

    // Load all areas (counties) on page load
    loadAllAreas();

    // Get inventory years from data
    $.ajax({
        type: 'GET',
        url: '/inventoryyear',
        success: function (response) {
            // Clear the current options in end_year
            $('#sel_year').empty();
            $('#sel_year').append(`<option value="Select">Select</option>`);

            // Populate the new options from the response
            response.startYears.forEach(function (year) {
                $('#sel_year').append(`<option value="${year}">${year}</option>`);
            });
        },
        error: function (error) {
            console.error('Error fetching end year options:', error);
        }
    });

    // Listen for changes in the first select (start_year)
    $('#sel_year').change(function () {
        // Get the selected value
        var e = document.getElementById("sel_year");
        selectedYear = e.options[e.selectedIndex].text;

        // Make sure it's not the default "Select" option
        if (selectedYear !== 'Select') {
            // Prepare the data to send in the AJAX request
            const dataToSend = { startYear: selectedYear };

            // AJAX call to fetch the end year options based on the selected start year
            $.ajax({
                type: 'POST',
                url: '/get_end_years',  // Endpoint to retrieve end year options
                data: dataToSend,
                traditional: true,
                success: function (response) {
                    // Clear the current options in end_year
                    $('#sel_year2').empty();
                    $('#sel_year2').append(`<option value="Select">Select</option>`);

                    // Populate the new options from the response
                    response.endYears.forEach(function (year) {
                        $('#sel_year2').append(`<option value="${year}">${year}</option>`);
                    });
                },
                error: function (error) {
                    console.error('Error fetching end year options:', error);
                }
            });
        }
    });

    // 
    $(".plusminuslevelonebutton").on("click", function () {
        $(this).toggleClass('active');
    });

    $('#angiospermfamilygroup').hide();

    $('#angiospermfamily').click(function () {
        $.ajax({
            url: '/family',
            data: { clade: "NCBITaxon_3398" },
            type: 'POST',
            traditional: true,
            success: function (responds) {
                $('#angiospermfamilygroup').empty();
                $(responds.familylisthtml).appendTo($('#angiospermfamilygroup'));
                $('#angiospermfamilygroup').toggle()
            },
            error: function (error) {
                console.log(error);
            }

        });

    });

    $('#gymnospermfamilygroup').hide();

    $('#gymnospermfamily').click(function () {
        $.ajax({
            url: '/family',
            data: { clade: "NCBITaxon_1437180" },
            type: 'POST',
            traditional: true,
            success: function (responds) {
                $('#gymnospermfamilygroup').empty();
                $('#gymnospermfamilygroup').append(responds.familylisthtml);
                $('#gymnospermfamilygroup').toggle()
            },
            error: function (error) {
                console.log(error);
            }

        });
    });

    $("#angiospermfamilygroup").on("click", "button.plusminusleveltwobutton", function () {
        $(this).toggleClass('active');
        var famname = $(this).attr('value');
        var divid = (famname.split(" "))[0] + 'genusgroup';

        var newdiv = $('<div id="' + divid + '" class="level-three-filter-box"></div>');

        if ($('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').length < 1) {
            newdiv.insertAfter($(this).parent());

            $.ajax({
                url: '/genus',
                data: { famname: famname, clade: "NCBITaxon_3398" },
                type: 'POST',
                traditional: true,
                success: function (responds) {
                    $('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').empty();
                    $('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').append(responds.genuslisthtml);
                },
                error: function (error) {
                    console.log(error);
                }
            });
        } else { $('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').remove(); }
    });

    $("#gymnospermfamilygroup").on("click", "button.plusminusleveltwobutton", function () {
        $(this).toggleClass('active');
        var famname = $(this).attr('value');
        var divid = (famname.split(" "))[0] + 'genusgroup';

        var newdiv = $('<div id="' + divid + '" class="level-three-filter-box"></div>');

        if ($('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').length < 1) {
            newdiv.insertAfter($(this).parent());

            $.ajax({
                url: '/genus',
                data: { famname: famname, clade: "NCBITaxon_1437180" },
                type: 'POST',
                traditional: true,
                success: function (responds) {
                    $('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').empty();
                    $('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').append(responds.genuslisthtml);
                },
                error: function (error) {
                    console.log(error);
                }
            });
        } else { $('.level-two-filter-box .level-three-filter-box[id="' + divid + '"]').remove(); }
    });


    $(document).on("click", ".plusminuslevelthreebutton", function () {
        $(this).toggleClass('active');
        var genname = $(this).attr('value');
        var clade;

        if ($(this).parents('div#angiospermfamilygroup').length) {
            clade = "NCBITaxon_3398";
        }
        else if ($(this).parents('div#gymnospermfamilygroup').length) {
            clade = "NCBITaxon_1437180";
        }

        var divid = clade + genname + 'genusgroup';

        var newdiv = $('<div id="' + divid + '" class="level-four-filter-box"></div>');

        if ($('.level-three-filter-box .level-four-filter-box[id="' + divid + '"]').length < 1) {
            newdiv.insertAfter($(this).parent());

            $.ajax({
                url: '/species',
                data: { genname: genname, clade: clade },
                type: 'POST',
                traditional: true,
                success: function (responds) {
                    $('.level-three-filter-box .level-four-filter-box[id="' + divid + '"]').empty();
                    $('.level-three-filter-box .level-four-filter-box[id="' + divid + '"]').append(responds.specieslisthtml);
                },
                error: function (error) {
                    console.log(error);
                }
            });
        } else { $('.level-three-filter-box .level-four-filter-box[id="' + divid + '"]').remove(); }
    });

    function fetchtreeData(filtdata) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                type: 'POST',
                url: '/treeclassmap',
                data: filtdata,
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

    function isGeoJSON(data) {
        // Check for GeoJSON structure
        return (
            data &&
            typeof data === "object" &&
            data.type &&
            (data.type === "FeatureCollection" && Array.isArray(data.features) ||
                data.type === "Feature" && data.geometry && data.geometry.type && Array.isArray(data.geometry.coordinates))
        );
    }

    function isPropNumeric(geojson) {

        // Access the first feature's density property
        const prop = geojson.features[0].properties && geojson.features[0].properties.prop;

        // Check if the density value is defined and is numeric
        return prop !== undefined && !isNaN(prop - parseFloat(prop));
    }

    function createmap(treedata, envdata) {

        // Remove only data layers from previous map generations, keep county layer
        const layersToRemove = [];
        map.getLayers().forEach(function(layer, index) {
            // Keep layers 0-2 (OSM base layer, empty vector layer, and county layer)
            // Remove any layers added by previous data generations (index > 2)
            if (index > 2) {
                layersToRemove.push(layer);
            }
        });
        layersToRemove.forEach(function(layer) {
            map.removeLayer(layer);
        });

        // Clear previous legends
        $('.choropleth-legend').remove();
        $('#map-legend').remove();

        // Use the existing map instead of creating a new one
        const treemap = map;

        // Create choropleth map
        if (isGeoJSON(envdata)) {

            if (isPropNumeric(envdata)) {
                // Step 1: Calculate min and max density values
                const propValues = envdata.features.map(feature => parseFloat(feature.properties.prop)).filter(val => !isNaN(val));
                const minValue = Math.min(...propValues);
                const maxValue = Math.max(...propValues);

                console.log('Min Value:', minValue, 'Max Value:', maxValue);

                // Step 2: Create a color scale (using chroma.js for smooth interpolation)
                const colorScale = chroma.scale(["blue", "white", "red"]).domain([minValue, 0, maxValue]);

                console.log('Color Scale:', colorScale);

                // Step 3: Update the style function to use the color scale
                function styleFunction(feature) {
                    const prop = parseFloat(feature.get('prop'));

                    if (isNaN(prop)) {
                        // Handle missing or invalid prop values, default to a neutral color or handle as needed
                        return new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: '#cccccc' // default color for invalid/missing data
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#333333',
                                width: 0.5
                            })
                        });
                    }

                    return new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: colorScale(prop).hex()
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#333333',
                            width: 0.01
                        })
                    });
                }

                const envvectorSource = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(envdata, {
                        featureProjection: 'EPSG:3857'
                    })
                });

                const envvectorLayer = new ol.layer.Vector({
                    source: envvectorSource,
                    style: styleFunction
                });

                treemap.addLayer(envvectorLayer);

                function updateLegend(min, max) {
                    // Select the legend div and set up the HTML structure
                    const choroplethlegend = $("<div>")
                        .addClass("choropleth-legend");

                    const bar = $("<div>").addClass("choropleth-legend-bar");
                    const lab = $("<div>").addClass("choropleth-legend-labels");

                    const mindiv = $("<span>").text(min);
                    const maxdiv = $("<span>").text(max);

                    lab.append(mindiv, maxdiv);
                    choroplethlegend.append(bar, lab);

                    // Set the gradient for the legend bar
                    const colorScale = chroma.scale(["blue", "white", "red"]).domain([min, 0, max]);
                    bar.css("background", `linear-gradient(to right, ${colorScale(min).hex()}, ${colorScale(max).hex()})`);

                    // Append the legend to the #visElement
                    $('#visElement').append(choroplethlegend);
                }


                // Call updateLegend with minValue and maxValue
                updateLegend(minValue, maxValue);
               
            } else {

                function getUniqueCategories(features, categoryField) {
                    const categories = new Set();
                    features.forEach(feature => {
                        const category = feature.get(categoryField);
                        if (category) {
                            categories.add(category);
                        }
                    });
                    return Array.from(categories);
                }

                function generateCategoryColors(categories) {
                    const colorScale = chroma.scale('Set3').colors(categories.length); // 'Set3' is a color scheme with vibrant, distinguishable colors
                    const categoryColors = {};
                    categories.forEach((category, index) => {
                        categoryColors[category] = colorScale[index];
                    });
                    return categoryColors;
                }

                function createStyleFunction(categoryColors) {
                    return function (feature) {
                        const prop = feature.get('prop');
                        const color = categoryColors[prop] || '#FFFFFF'; // default to white if no match
                        return new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: color
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#333333',
                                width: 0.01
                            })
                        });
                    };
                }

                function createLegend(categoryColors) {
                    const legendContent = $("<div>")
                        .addClass("choropleth-legend");

                    // Iterate over each category in categoryColors
                    for (const [category, color] of Object.entries(categoryColors)) {
                        // Create a list item for each category
                        const listItem = document.createElement('li');
                        listItem.style.display = 'flex';
                        listItem.style.alignItems = 'center';
                        listItem.style.marginBottom = '4px';

                        // Create a color box
                        const colorBox = document.createElement('span');
                        colorBox.style.backgroundColor = color;
                        colorBox.style.width = '16px';
                        colorBox.style.height = '16px';
                        colorBox.style.display = 'inline-block';
                        colorBox.style.marginRight = '8px';
                        colorBox.style.border = '1px solid #333';

                        // Add the category name next to the color box
                        const labelText = document.createElement('span');
                        labelText.textContent = category;

                        // Append color box and text to the list item
                        listItem.appendChild(colorBox);
                        listItem.appendChild(labelText);

                        // Add the list item to the legend content
                        legendContent.append(listItem);
                    }

                    $('#visElement').append(legendContent)
                }

                

                const envvectorSource = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(envdata, {
                        featureProjection: 'EPSG:3857'
                    })
                });

                const cellfeatures = envvectorSource.getFeatures();
                const uniqueCategories = getUniqueCategories(cellfeatures, 'prop');
                const categoryColors = generateCategoryColors(uniqueCategories);
                const styleFunction = createStyleFunction(categoryColors);

                console.log(categoryColors)

                const envvectorLayer = new ol.layer.Vector({
                    source: envvectorSource,
                    style: styleFunction
                });

                treemap.addLayer(envvectorLayer);

                
                createLegend(categoryColors);

            }
        }

        // Calculate min and max treecount for colormap scaling
        const treeCounts = [];
        treedata.features.forEach(feature => {
            treeCounts.push(feature.properties.treecount);
        });
        const tmax = Math.max(...treeCounts);
        const tmin = Math.min(...treeCounts);

        // Define a color scale based on min and max treecount values
        function getColor(treecount) {
            if (treecount < 3) return '#004D40';
            if (treecount < 10) return '#D81B60';
            if (treecount < 20) return '#FF7D00';
            if (treecount < 50) return '#FFA500';
            return '#01019B';

            /**
            const normalized = (treecount - tmin) / (tmax - tmin);
            if (normalized < 0.25) return '#D81B60';
            if (normalized < 0.5) return '#FF7D00';
            if (normalized < 0.75) return '#FFA500';
            if (normalized <= 1) return '#01019B';
            return '#004D40';
            */
        }

        // Loop through each feature to create OpenLayers features with style
        const plots = treedata.features.map(feature => {
            const coordinates = feature.geometry.coordinates;  // Assuming Point geometry
            const treecount = feature.properties.treecount;
            const color = getColor(treecount);

            const olFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(coordinates))
            });

            olFeature.setStyle(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill: new ol.style.Fill({ color: color }),
                    stroke: new ol.style.Stroke({ color: 'black', width: 0.5 })
                })
            }));

            return olFeature;
        });

        // Add features to vector source and layer
        const plotvectorSource = new ol.source.Vector({ features: plots });
        const plotvectorLayer = new ol.layer.Vector({ source: plotvectorSource });
        treemap.addLayer(plotvectorLayer);
    }

    function createmaplegend(filtdata, data) {

        // Calculate min and max treecount for colormap scaling
        //const treeCounts = data.features.map(feature => feature.properties.treecount);
        const treeCounts = [];
        data.features.forEach(feature => {
            treeCounts.push(feature.properties.treecount);
        });
        const tmax = Math.max(...treeCounts);
        const tmin = Math.min(...treeCounts);

        // Color legend
        const legendHtml = `
                <div class="map-legend" id="map-legend">
                    <div>
                    <h5>${filtdata.year} Inventory of ${filtdata.cname} in Maine</h5>
                    <div><span style="background-color:#004D40; width:20px; height:10px; display:inline-block;"></span> 1-2 </div>
                    <div><span style="background-color:#01019B; width:20px; height:10px; display:inline-block;"></span> 3-9 </div>
                    <div><span style="background-color:#FFA500; width:20px; height:10px; display:inline-block;"></span> 10-19 </div>
                    <div><span style="background-color:#FF7D00; width:20px; height:10px; display:inline-block;"></span> 20-49 </div>
                    <div><span style="background-color:#D81B60; width:20px; height:10px; display:inline-block;"></span> 50+ </div>
                    </div>
                    <div>
                    <h6>Range<h6>
                    <p>${tmin} - ${tmax}<p>
                </div >`;
        $('#visElement').append(legendHtml);
    }

    // Store filter data as user selects options
    let filtdata = {};

    $(".text-button-levelone").click(function () {

        // Remove highlight from all buttons with the "highlightable" class
        $(".taxbutton").removeClass("highlighted");

        // Add highlight to the clicked button
        $(this).addClass("highlighted");

        filtdata.cname = $(this).attr('cname');
        var e = document.getElementById("sel_year");
        filtdata.year = e.options[e.selectedIndex].text;
        console.log(filtdata)
    });

    $(document).on("click", ".text-button-leveltwo", function () {

        // Remove highlight from all buttons with the "highlightable" class
        $(".taxbutton").removeClass("highlighted");

        // Add highlight to the clicked button
        $(this).addClass("highlighted");

        filtdata. cname = $(this).attr('cname');
        var e = document.getElementById("sel_year");
        filtdata.year = e.options[e.selectedIndex].text;
        console.log(filtdata)
    });

    $(document).on("click", ".text-button-levelthree", function () {

        // Remove highlight from all buttons with the "highlightable" class
        $(".taxbutton").removeClass("highlighted");

        // Add highlight to the clicked button
        $(this).addClass("highlighted");

        filtdata.cname = $(this).attr('cname');
        var e = document.getElementById("sel_year");
        filtdata.year = e.options[e.selectedIndex].text;
        console.log(filtdata)
    });

    $(document).on("click", ".text-button-levelfour", function () {

        // Remove highlight from all buttons with the "highlightable" class
        $(".taxbutton").removeClass("highlighted");

        // Add highlight to the clicked button
        $(this).addClass("highlighted");

        filtdata.cname = $(this).attr('cname');
        var e = document.getElementById("sel_year");
        filtdata.year = e.options[e.selectedIndex].text;
        console.log(filtdata)
    });

    $('.treepropslidercheckbox').on('change', function () {
        
        filtdata.quality = $(this).attr('value');

        // Select the second div using a proper selector
        var sliderlist = $(this).parent().find('.slider');
        var sliderDiv = sliderlist[0]

        if ($(this).is(':checked')) {
            // If checkbox is checked, create the slider
            $.ajax({
                type: 'POST',
                data: filtdata,
                url: '/minmaxtree',
                traditional: true,
                success: function (data) {
                    minvalue = Number(data.datamin);
                    maxvalue = Number(data.datamax);
                    noUiSlider.create(sliderDiv, {
                        start: [minvalue, maxvalue],
                        tooltips: true,
                        step: 0.1,
                        connect: true,
                        range: {
                            'min': minvalue,
                            'max': maxvalue
                        }
                    });

                    // Show the slider div
                    $(sliderDiv).show(); 
                }
            });   
        } else {
            // If checkbox is unchecked, hide the slider div
            $(sliderDiv).hide();
        }
    });

    $('.treepropclassgroupcheckbox').on('change', function () {

        filtdata.quality = $(this).attr('value');

        // Select the second div using a proper selector
        var categorygrouplist = $(this).parent().find('.classgroup');
        var categorygroupDiv = categorygrouplist[0]

        if ($(this).is(':checked')) {
            $.ajax({
                type: 'POST',
                data: filtdata,
                url: '/categorygrouptree',
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

    $(".environvariablechkbox").on("change", function () {
        // If the checkbox is checked, disable all others
        if ($(this).is(":checked")) {
            $(".environvariablechkbox").not(this).prop("disabled", true);

            filtdata.env_prop = $(this).attr('value');
        } else {
            // If it's unchecked, re-enable all checkboxes
            $(".environvariablechkbox").prop("disabled", false);
        }


    });


    $("#generateMapButton").on("click", function () {

        filtdata.selectedmetric = 'presenceAbsence' ; //$('input[name="metricbtnradio"]:checked').val();

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

        filtdata.dbhrange = getSliderRange($('#dbhcheckbox'), dbhslider);
        filtdata.tahrange = getSliderRange($('#tahcheckbox'), tahslider);
        filtdata.tthrange = getSliderRange($('#tthcheckbox'), tthslider);
        filtdata.selts = getSelectedValues($('#tscheckbox'), $('#tsgroup'));

        fetchtreeData(filtdata)
            .then(function (data) {
                console.log('Data fetched successfully', data);
                treedata = data.treedata;
                envdata = data.envdata;
                console.log(treedata)
                console.log(envdata)

                // Add data layers to existing map (don't clear it)
                createmap(treedata, envdata);

                // Add legend
                createmaplegend(filtdata, treedata);
            })
            .catch(function (error) {
                // Catch block to handle errors from any `.then()` in the chain
                console.error('Error occurred:', error);
            });
    });

});

    