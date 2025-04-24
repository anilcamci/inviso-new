import Helpers from '../../utils/helpers';
import Config from '../../data/config';

export default class SoundSearch {
    constructor(main) {
        this.app = main;
        this.container = document.getElementById('SoundSearch');
        this.container.style.display = 'none';

        this.results = [];
        this.searchTerm = "";
        this.maxReturn = 5;
        this.uris = {
            base: 'https://freesound.org/apiv2',
            textSearch: '/search/text/',
            download: '/sounds/<sound_id>/download/',
            query: '?query=',
            fields: '&fields=id,name,url,duration,download,previews',
            sort: '&sort=score', // score, downloads_desc, rating_desc
            auth: '&token=poblNq6udgd9950X4KNLyuBKPuNxBA27mxZsqh2y'
        }
        this.token = "poblNq6udgd9950X4KNLyuBKPuNxBA27mxZsqh2y";

        this.isShowing = false;
    }

  // ------- showing/hiding the overall gui ---------- //

    display() {
        // Show search bar
        var div = document.createElement("div");
        div.className = "search-bar";
        div.id = "search-bar";

        var node = document.createElement('span');
        node.onmousedown = this.mouseIsDown.bind(this);
        node.onkeydown = this.typingInput.bind(this);

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = "Search sounds on freesound.org";
        input.id = "search-input";
        input.disabled = false;
        if (this.searchTerm != "") {
            input.value = this.searchTerm;
        }
        node.appendChild(input);

        div.appendChild(node);

        this.container.appendChild(div);
        this.container.style.display = 'inline-block';
        this.isShowing = true;

        // If there are previous results, show them
        if (this.results.length > 0) {
            this.displayResults();
        }

        window.addEventListener('click', this.clickAway.bind(this), false);
        document.getElementById('search-input').addEventListener('keyup', function(e) {
            this.checkInputState(e);
        }.bind(this), false);
    }

    hide() {
        // this.clearResults();
        this.container.innerHTML = '';
        this.container.style.display = 'none';
        this.isShowing = false;

        // Disable right clicks and re-enable other controls
        this.app.controls.enableZoom();
        this.app.controls.enablePan();
        document.removeEventListener('contextmenu', this.pausecontextmenu, true);
    }

    clickAway(e) {
        // Check if user is clicking on search area
        var onSearchResults = document.getElementById('search-results') ? document.getElementById('search-results').contains(e.target) : false;
        var onSearchBtn = document.getElementById('search-clear-search-button') ? document.getElementById('search-clear-search-button').contains(e.target) : false;
        var onSearchBar = document.getElementById('search-bar') ? document.getElementById('search-bar').contains(e.target) : false;

        // If user is not clicking on any of the search bar areas, hide menu
        if (!(onSearchResults || onSearchBtn || onSearchBar)) {
            this.isShowing = true;
            this.app.toggleSearchBar();
        }
    }

    mouseIsDown() {
        this.app.controls.disable();
    }

    typingInput(e) {
        var inputValue = e.target.value

        // Check for enter and that value is a number
        if (e.keyCode == 13) {
            this.getFreeSounds(inputValue);
            this.app.controls.enable();
            this.searchTerm = inputValue;
        }
    }

    getFreeSounds(searchTerm) {
        // Format request url
        var data = ""
        var requestURL = this.uris.base + this.uris.textSearch + this.uris.query + searchTerm + this.uris.fields + this.uris.sort + this.uris.auth

        // Send API request to freesound.org
        let request = new XMLHttpRequest();
        request.open("GET", requestURL);
        request.send();
        request.onload = () => {
            if (request.status === 200) {
                data = JSON.parse(request.response);
                this.results = [];
                this.getResults(data);
            }
            else {
                console.log("error " + String(request.status) + " " + String(request.statusText));
            }
        }

        return data;
    }

    getResults(data) {
        // Store returned JSON data
        var maxReturn = 5;
        for (var i = 0; i < data.results.length; ++i) {
            if (i < this.maxReturn) {
                this.results.push({
                    id: data.results[i].id,
                    name: data.results[i].name,
                    url: data.results[i].url,
                    duration: data.results[i].duration,
                    download: data.results[i].download,
                    previews: data.results[i].previews
                })
            }
            else {
                break;
            }
        }

        this.displayResults();
    }

    displayResults() {
        var existingResult = document.getElementById("search-results")
        if (existingResult) {
            existingResult.remove();
        }

        var div = document.createElement("div");
        div.id = "search-results";
        for (var i = 0; i < this.results.length; ++i) {
            // Add audio title and audio link
            var node = document.createElement('p');
            node.id = "search-result";
            node.innerHTML = this.results[i].name;

            var download = "<a id='download-link' href='"
                          + this.results[i].previews["preview-lq-mp3"]
                          + "' download='audio.mp3' target='_blank'>"
                          + this.results[i].name + "</a>"
            node.innerHTML = download;

            // Add audio player
            var previewPlayer = document.createElement('div');
            var audioHTML = "<audio controls><source src='" + this.results[i].previews["preview-lq-mp3"] +  "' type='audio/mp3'></audio>"
            previewPlayer.id = "audio-player";
            previewPlayer.innerHTML = audioHTML;
            node.appendChild(document.createElement('br'));
            node.appendChild(previewPlayer);

            div.appendChild(node);

            // Enable right clicks and disable other controls
            this.app.controls.disableZoom();
            this.app.controls.disablePan();
            document.addEventListener('contextmenu', this.pausecontextmenu, true);
        }
        if (this.results.length === 0) {
            // Show no results if none found
            var node = document.createElement('p');
            node.innerHTML = "No results found";
            node.className = 'search-result';
            node.style.padding = "0 0 10px 0";
            div.appendChild(node);

            // Disable right clicks and re-enable other controls
            this.app.controls.enableZoom();
            this.app.controls.enablePan();
            document.removeEventListener('contextmenu', this.pausecontextmenu, true);
        }

        this.container.appendChild(div);
    }

    // Remove any existing results
    clearResults() {
        var existingResult = document.getElementById("search-results")
        if (existingResult) {
            existingResult.remove();
        }

        this.results = [];
        this.searchTerm = "";
    }

    // Clear results if there is no search item
    checkInputState(e) {
        if (e.target.value.length == 0) {
            this.clearResults();
        }
    }

    // Enable/disable right-clicks
    pausecontextmenu(event) {
      event.stopPropagation();
    }
}
