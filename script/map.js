class Leaflet {
    map;
    markers = [];
    satelliteIndex = 0;
    icons = {
        dot: L.icon({
            iconUrl: './public/dot.png',
            iconSize: [20, 20],
            zIndexOffset: 1000
        })
    }

    constructor(lat, lon, zoom) {
        this.#initializeMap(lat, lon, zoom)
    }

    /**
     * Adds marker to map. Extracts the information from the given satellite.
     * @param satellite
     */
    addSatellite(satellite) {
        // Check if the ID is already in the markers array, if so, replace the marker with a dot.
        if (this.markers.find(marker => marker.id === satellite.id)) {
            this.replaceSatelliteWithDot(satellite)
        }

        // Create icon and add it to map with options
        const mapMarker = L.marker([satellite.latitude, satellite.longitude], {
            icon: L.icon({
                iconUrl: window.location.href.includes('github') ? `SatTrack/public/satellite${this.satelliteIndex}.png` : `../public/satellite${this.satelliteIndex}.png`,
                iconSize: [50, 50],
                zIndexOffset: -1000
            }),
            title: satellite.name,
            riseOnHover: true,
            riseOffset: 250
        }).addTo(this.map)

        // Adds the popup/tooltip to the marker
        mapMarker
            .bindPopup(`<b>${satellite.name.toUpperCase()}</b> (${satellite.latitude.toFixed(2)}, ${satellite.longitude.toFixed(2)})<br>
                                Altitude: ${satellite.altitude.toFixed(2)}, Velocity ${satellite.velocity.toFixed(2)} ${satellite.units[0]}/h<br>
                                Visibility: ${satellite.visibility}, Timestamp: ${new Date(satellite.timestamp*1000).toLocaleString()}`)

        // Adds the marker to the markers array, so we can modify/reference it in the future (i.e. delete it)
        this.markers.push({
            id: satellite.id,
            marker: mapMarker
        })

        // Method chaining
        return this;
    }

    replaceSatelliteWithDot(satellite) {
        // Find all markers with the same ID via map and return an array
        const markers = this.markers.filter(marker => marker.id === satellite.id)

        // If the marker exists, replace it with a dot
        if (markers) {
            for (const marker of markers) {
                marker.marker.setIcon(this.icons.dot)
            }
        }

        // Method chaining
        return this;
    }

    /**
     * Finds satellite by its ID and removes it from map and markers[].
     * @param satellite
     */
    removeSatellite(satellite) {
        this.map.removeLayer(this.markers.find(m => m.id === satellite.id).marker)
        this.markers.splice(this.markers.findIndex(m => m.id === satellite.id), 1)

        return this;
    }

    /**
     * Moves the map to the given coordinates of the satellite using the same zoom level.
     * @param satellite
     */
    zoomToSatellite(satellite) {
        if (!this.markers.find(m => m.id === satellite.id).marker) {
            throw new Error('Satellite not found. Could not reposition map.')
        }
        this.map.setView(this.markers.find(m => m.id === satellite.id).marker.getLatLng(), this.map.getZoom())

        return this;
    }

    /**
     * Creates a leaflet map instance and sets the map to the OpenStreetMap tile layer.
     * The map is stored in a property of the class.
     * @param lat
     * @param lon
     * @param zoom
     */
    #initializeMap(lat, lon, zoom) {
        this.map = L.map('map').setView([lat, lon], zoom)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; <a href="https://www.flaticon.com/free-icons/satellite" title="satellite icons">Satellite icons created by Freepik - Flaticon</a>'
        }).addTo(this.map);

        this.map.setMinZoom(2).setMaxZoom(18)
    }
}

class Satellite {
    id;
    url;
    name;
    altitude;
    daynum;
    footprint;
    latitude;
    longitude;
    solar_lat;
    solar_lon;
    timestamp;
    units;
    velocity;
    visibility;
    fetchResponse;
    errorBool;
    errorCode;
    errorText;
    autoUpdater;

    constructor(id) {
        this.id = id;
        this.url = `https://api.wheretheiss.at/v1/satellites/${id.toString()}`
    }

    async fetchSatellite() {
        const result = await fetch(this.url);

        if (!result.ok) {
            this.errorBool = true;
            this.errorCode = result.status;
            this.errorText = result.statusText;
            console.log(this.errors); return;
        }

        const json = await result.json();

        this.id = json['id']
        this.name = json['name']
        this.altitude = json['altitude']
        this.daynum = json['daynum']
        this.footprint = json['footprint']
        this.latitude = json['latitude']
        this.longitude = json['longitude']
        this.solar_lat = json['solar_lat']
        this.solar_lon = json['solar_lon']
        this.timestamp = json['timestamp']
        this.units = json['units']
        this.velocity = json['velocity']
        this.visibility = json['visibility']
        this.fetchResponse = json

        return this;
    }

    /**
     *
     * @param trueOrFalse
     * @param interval
     * @param map
     * @returns {Satellite}
     */
    autoUpdate(trueOrFalse, interval, map) {
        // Guard clauses
        if (interval < 1000) throw new Error('Interval must be at least 1000 milliseconds.');

        if (!map) throw new Error('Map is not given.')

        if (!typeof trueOrFalse === 'boolean') throw new Error('Argument must be a boolean.');

        // If instructed to turn off ('false'), we clear the interval and stop function execution.
        if (!trueOrFalse) {
            clearInterval(this.autoUpdater);
            return this;
        }

        // If autoUpdater is already on, this will clear it, so it can be restarted with a new interval.
        if (trueOrFalse) {
            clearInterval(this.autoUpdater);
            console.warn(`Auto-update already turned on. Restarting at ${interval}ms.`);
        }

        this.autoUpdater = setInterval(async () => {
            await this.fetchSatellite();
            map.addSatellite(this);
        }, interval)

        return this;
    }


    destroy(map) {
        map.removeSatellite(this)
        delete this
    }

    get errors() {
        return {
            id: this.id,
            url: this.url,
            errorBool: this.errorBool,
            errorCode: this.errorCode,
            errorText: this.errorText
        }
    }
}

async function mapControl() {
    // Create a new map at the Center of the World
    const map = new Leaflet(20.7502, 114.7655, 3)

    // Creates a new satellite object and retrieves the data from the API.
    const iss = await new Satellite(25544).fetchSatellite();

    // Adds the satellite to the map, zooms to it, and sets the auto-update interval to 15 seconds.
    map.addSatellite(iss);
    map.zoomToSatellite(iss);
    iss.autoUpdate(true, 15000, map)

    // For debugging purposes, we can print the satellite's data to the console.
    console.log(iss)

    // In the header, is a number input which can be changed to update the auto-update interval.
    // Only values < 60 and > 5 are valid. If false, it auto-resets it to the default: 15 seconds.
    // TODO: Add visual error feedback via Bootstrap..
    document.getElementById('updateTime').addEventListener('change', (numberInput) => {
            domAutoUpdate(numberInput, numberInput.target.value, iss, map)
    })

    document.getElementById('satellitePickerLeft').addEventListener('click', () => {
        changeSatellite(map, 'left');
    });

    document.getElementById('satellitePickerRight').addEventListener('click', () => {
        changeSatellite(map, 'right');
    });
}
mapControl();

function domAutoUpdate(domButton, interval, satellite, map) {
    interval *= 1000; // Convert seconds to milliseconds

    // Error handling feedback
    if (interval > 60000 || interval < 5000) {
        document.getElementById('updateFormTag').classList.add('needs-validation', 'was-validated');

        // If they input a value that is too low, we need to reset it to the default.
        // We wait 3s to enhance the UX experience.
        const resetUpdater = setTimeout(() => {
            domButton.target.value = 15; // Reset to default 15 seconds
            satellite.autoUpdate(true, domButton.target.value, map)
        }, 5000);

        // If the user corrects their input before the setTimeout does, we need to break the setTimeout.
        const interruptUpdateReset = setInterval(() => {
            if (domButton.target.value < 60 && domButton.target.value > 5) {
                clearTimeout(resetUpdater);
                clearInterval(interruptUpdateReset)
            }
        }, 20);

        console.error('Update interval must be between 1 and 60 seconds. Defaulting to 15 seconds.')
    } else {
        satellite.autoUpdate(true, interval, map)
    }
}

function changeSatellite(map, leftOrRight) {
    const satelliteIcon = document.getElementById(('satellitePickerIcon'));
    const currentSatelliteNumber = parseInt(satelliteIcon.src.charAt(satelliteIcon.src.length - 5));


    let newSatelliteNumber = leftOrRight === 'left' ? currentSatelliteNumber - 1 : currentSatelliteNumber + 1;
    if (newSatelliteNumber > 5) newSatelliteNumber = 0;
    if (newSatelliteNumber < 0) newSatelliteNumber = 5;

    if (window.location.href.includes('github')) {
        satelliteIcon.src = `SatTrack/public/satellite${newSatelliteNumber}.png`;
    } else {
        satelliteIcon.src = `../public/satellite${newSatelliteNumber}.png`;
    }


    // See if windows.location.href contains 'github'
    if (window.location.href.includes('github'))

    map.satelliteIndex = newSatelliteNumber;

    map.markers[map.markers.length - 1].marker.setIcon(L.icon({
        iconUrl: `../public/satellite${newSatelliteNumber}.png`,
        iconSize: [50, 50],
        zIndexOffset: -1000,
    }));
}