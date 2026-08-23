jQuery(document).ready(function () {

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
                center: [-69.809594, 44.579433],
                zoom: 7,
                projection: 'EPSG:4326' //WGS1984/GPS
            })
        });
    }

    // Initialize the map
    initMap();

})

