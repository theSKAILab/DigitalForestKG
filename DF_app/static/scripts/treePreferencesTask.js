jQuery(document).ready(function () {

    $("#loading-message").hide()

    /* For spinner */
    $('#preferences-spinner').hide();
    $(document).ajaxStop(function () {
        $('#preferences-spinner').hide();
    });

    $(document).ajaxStart(function () {
        $('#preferences-spinner').show();
    });

    var map;

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
                //center: ol.proj.fromLonLat([-72.809594, 43.979433]),
                center: [-72.809594, 43.979433],
                zoom: 7,
                projection: 'EPSG:4326'
            })
        });
    }

    // Initialize the map
    initMap();

    $(".pref-table-window").hide();

    $.ajax({
        type: 'GET',
        url: '/treeswithpreferences',
        success: function (data) {
            $("#treesWithPreferencesgroup").empty();
            $("#treesWithPreferencesgroup").append(data.treeslisthtml);
        },

    });

    /*
    function insertSpacesBetweenWords(inputString) {
        // Use regular expression to insert spaces between words
        return inputString.replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    function extractCluster(text) {
        var match = text.match(/Cluster\d+/); // Use regular expression to find "Cluster" followed by a number
        return match ? match[0] : null; // Return the matched text or null if no match
    }

    function extractFromCluster(text) {
        var index = text.indexOf('Cluster');
        return index !== -1 ? text.substring(index) : null; // Return the substring from 'Cluster' onwards or null if not found
    }
    
    // Add change event listener to the parent container
    $('#treesWithPreferencesgroup').on('change', 'input[type="radio"]', function () {
        // Check if the radio button is checked
        if ($(this).is(':checked')) {
            // Get the value of the checked radio button
            selectedtree = $(this).val();

            // Perform the desired action with the selected value
            console.log("Selected value: " + selectedtree);

            $.ajax({
                type: 'POST',
                data: { selectedtree: selectedtree },
                url: '/treepreferences',
                traditional: true,
                success: function (data) {
                    var prefdata = JSON.parse(data['pref_data'])
                    //var prefdata = data['pref_data']
                    console.log(prefdata)
                    $('#treePreferencestables').empty();
                    //var uniqueClusters = [...new Set(prefdata.map(item => item.cluster))];
                    var uniqueClusters = [...new Set(prefdata.cluster)];
                    console.log(uniqueClusters)

                    // Create HTML tables for each unique cluster
                    uniqueClusters.forEach(function (cluster) {
                        //var table_title = insertSpacesBetweenWords(cluster)
                        var table_title = extractFromCluster(cluster)
                        // Filter indices for the current cluster
                        var indices = prefdata.cluster.reduce((acc, val, index) => {
                            if (val === cluster) acc.push(index);
                            return acc;
                        }, []);
                        console.log(indices)

                        // Create table HTML
                        var tableHTML = '<h5 class="table-title">' + table_title + '</h5>';
                        tableHTML += '<table><thead><tr><th class="select-column"></th><th class="variable-column">Environmental Variable</th><th class="minimum-column">Minimum</th><th class="maximum-column">Maximum</th><th class="rank-column">Importance Rank</th></tr></thead><tbody>';

                        // Populate table with data for the current cluster
                        indices.forEach(function (index) {
                            tableHTML += '<tr>';
                            tableHTML += '<td class="select-column"><input type="checkbox" name="prefvariable" data-min="' + prefdata.minimum[index] + '" data-max="' + prefdata.maximum[index] + '" value="' + prefdata.variable[index] + '"></td>';
                            tableHTML += '<td class="variable-column">' + prefdata.variable[index] + '</td>';
                            tableHTML += '<td class="minimum-column">' + prefdata.minimum[index] + '</td>';
                            tableHTML += '<td class="maximum-column">' + prefdata.maximum[index] + '</td>';
                            tableHTML += '<td class="rank-column">' + prefdata.rank[index] + '</td>';
                            
                            tableHTML += '</tr>';
                        });

                        tableHTML += '</tbody></table>';

                        // Append table HTML to the container
                        $('#treePreferencestables').append(tableHTML);
                        
                    });

                    $('.pref-table-window').show();
                },

            });
        };
    });
    */

    // Add change event listener to the parent container
    $('#treesWithPreferencesgroup').on('change', 'input[type="radio"]', function () {

        // Check if the radio button is checked
        if ($(this).is(':checked')) {
            // Get the value of the checked radio button
            let selectedtree = $(this).val();

            // Perform the desired action with the selected value
            console.log("Selected value: " + selectedtree);

            $.ajax({
                type: 'POST',
                data: { selectedtree: selectedtree },
                url: '/treepreferences',
                traditional: true,
                success: function (data) {
                    let prefdata = JSON.parse(data['pref_data']);
                    console.log(prefdata);

                    // Clear the existing table
                    $('#treePreferencestables').empty();

                    // Start building the table HTML
                    let tableHTML = '<h5 class="table-title">Tree Preferences</h5>';
                    tableHTML += '<table><thead><tr><th class="select-column"></th><th class="variable-column">Environmental Variable</th><th class="minimum-column">Minimum</th><th class="maximum-column">Maximum</th><th class="rank-column">Importance Rank</th></tr></thead><tbody>';

                    // Populate the table with data
                    for (let i = 0; i < prefdata.variable.length; i++) {
                        tableHTML += '<tr>';
                        tableHTML += '<td class="select-column"><input type="checkbox" name="prefvariable" data-min="' + prefdata.minimum[i] + '" data-max="' + prefdata.maximum[i] + '" value="' + prefdata.variable[i] + '"></td>';
                        tableHTML += '<td class="variable-column">' + prefdata.variable[i] + '</td>';
                        tableHTML += '<td class="minimum-column">' + prefdata.minimum[i] + '</td>';
                        tableHTML += '<td class="maximum-column">' + prefdata.maximum[i] + '</td>';
                        tableHTML += '<td class="rank-column">' + prefdata.rank[i] + '</td>';
                        tableHTML += '</tr>';
                    }

                    tableHTML += '</tbody></table>';

                    // Append the table HTML to the container
                    $('#treePreferencestables').append(tableHTML);

                    // Show the table container
                    $('.pref-table-window').show();
                },
            });

        }
    });


    $('#treePreferencestables').on('change', 'input[type="checkbox"]', function () {

        // Define the data object
        pref_data = {
            'variable': [],
            'min': [],
            'max': []
        };

        $('#treePreferencestables input:checked').each(function () {
            var checkbox = $(this);
            var isChecked = checkbox.prop('checked');
            var variableName = checkbox.val();
            var min = parseInt(checkbox.data('min'));
            var max = parseInt(checkbox.data('max'));

            // Check if checkbox is checked or unchecked
            if (isChecked) {
                // Append data to the corresponding arrays
                pref_data['variable'].push(variableName);
                pref_data['min'].push(min);
                pref_data['max'].push(max);
            } else {
                // Remove data from the corresponding arrays if unchecked
                var index = pref_data['variable'].indexOf(variableName);
                if (index !== -1) {
                    pref_data['variable'].splice(index, 1);
                    pref_data['min'].splice(index, 1);
                    pref_data['max'].splice(index, 1);
                }
            }
            console.log(pref_data)
        });
    });


    function fetchfeasibilityData(prefdata) {
        return new Promise(function (resolve, reject) {
            $.ajax({
                type: 'POST',
                url: '/feasibiltycheck',
                contentType: 'application/json',
                data: JSON.stringify(prefdata),
                success: function (data) {
                    resolve(data)
                },
                error: function (error) {
                    reject(error)
                }
            });
        });
    }

    // Define the color range and feasibility thresholds
    var feasibilityColors = ["#004D40", "#01019B", "#FFA500", "#FF7D00", "#D81B60"];  // Pink to Dark Green
    var thresholds = [0, 0.25, 0.5, 0.75, 1];  // Quantile thresholds

    // Function to get the color based on feasibility value
    function getFeasibilityColor(feasibility) {
        if (feasibility <= thresholds[0]) return feasibilityColors[0];
        if (feasibility <= thresholds[1]) return feasibilityColors[1];
        if (feasibility <= thresholds[2]) return feasibilityColors[2];
        if (feasibility <= thresholds[3]) return feasibilityColors[3];
        return feasibilityColors[4];
    }

    $("#createfeasibilitymap").click(function () {

        $("#loading-message").show()

        fetchfeasibilityData(pref_data)
            .then(function (data) {
                console.log('Data fetched successfully');
                feasibilitydata = data.feasibility_data;

                // Clear current map content
                $('#visElement').empty();
                $(".pref-table-window").hide();

                // Initialize a new map view
                var feasibilitymap = new ol.Map({
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

                // Create a vector source from from feasibility data
                var vectorSource_feasibilitydata = new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(feasibilitydata, {
                        dataProjection: 'EPSG:4326', // Assuming your data is in this projection
                        featureProjection: 'EPSG:3857' // OpenLayers uses this for map display
                    })
                });

                // Create a style function to dynamically color based on feasibility
                var styleFunction = function (feature) {
                    var feasibility = feature.get('feasibility');
                    var color = getFeasibilityColor(feasibility);
                    return new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: color
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 0.05
                        })
                    });
                };

                // Create the vector layer
                var vectorLayer = new ol.layer.Vector({
                    source: vectorSource_feasibilitydata,
                    style: styleFunction
                });

                // Add the vector layer to the map
                feasibilitymap.addLayer(vectorLayer);

                // Tooltip display on hover
                var overlay = new ol.Overlay({
                    element: document.getElementById('popup'),  // Tooltip container
                    positioning: 'top-right',
                    stopEvent: false,
                    offset: [0, -10]
                });
                feasibilitymap.addOverlay(overlay);

                // Map hover event to display tooltip
                feasibilitymap.on('pointermove', function (event) {
                    var feature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
                        return feature;
                    });
                    if (feature) {
                        var coordinate = event.coordinate;
                        var feasibility = feature.get('feasibility');  // Replace with actual property
                        var tooltipContent = `<strong>Feasibility: </strong> ${feasibility}`;
                        $(overlay.getElement()).html(tooltipContent);
                        overlay.setPosition(coordinate);
                        $('#popup').show();
                    } else {
                        $('#popup').hide();
                    }
                });

                // Add color legend manually in HTML
                var legendHtml = `
                <div class="map-legend" id="map-legend">
                    <h4>Feasibility</h4>
                    <div><span style="background-color:#D81B60;"></span> High</div>
                    <div><span style="background-color:#FF7D00;"></span> Medium-High</div>
                    <div><span style="background-color:#FFA500;"></span> Medium</div>
                    <div><span style="background-color:#01019B;"></span> Low-Medium</div>
                    <div><span style="background-color:#004D40;"></span> Low</div>
                </div>`;
                $('#visElement').append(legendHtml);
            })
            .catch(function (error) {
                // Catch block to handle errors from any `.then()` in the chain
                console.error('Error occurred:', error);
            });
    });
});

