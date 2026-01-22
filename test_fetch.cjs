
const https = require('https');
const fs = require('fs');

const JELLYFIN_URL = 'https://juncokstreams.stream';
const JELLYFIN_API_KEY = '3d5eabb105cb406ba40fe81e5fd47059';

const logFile = fs.createWriteStream('debug_output_3.txt');
function log(msg) {
    console.log(msg);
    logFile.write(msg + '\n');
}

function fetchUrl(url, label) {
    const options = {
        headers: {
            'Accept': 'application/json',
            'X-Emby-Token': JELLYFIN_API_KEY
        }
    };

    https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                log(`[${label}] Error: ${res.statusCode}`);
                return;
            }
            try {
                const json = JSON.parse(data);
                if (json.Items) {
                    log(`[${label}] TotalRecordCount: ${json.TotalRecordCount}, Returned: ${json.Items.length}`);
                } else {
                    log(`[${label}] No Items array.`);
                }
            } catch (e) {
                log(`[${label}] Parse Error: ${e.message}`);
            }
        });
    });
}

// 1. Global Search NO SORT
const url1 = `${JELLYFIN_URL}/Items?IncludeItemTypes=Movie,Series&Limit=100&Recursive=true&Fields=Name,Type`;
fetchUrl(url1, "Global NoSort");

// 2. Global Search NO RECURSIVE (should return 0 probably)
const url2 = `${JELLYFIN_URL}/Items?IncludeItemTypes=Movie,Series&Limit=100&Fields=Name,Type`;
fetchUrl(url2, "Global NoRecursive");

// 3. UserViews (Libraries)
const url3 = `${JELLYFIN_URL}/userViews`; // This is the standard endpoint for libraries
fetchUrl(url3, "UserViews");
