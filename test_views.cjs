
const https = require('https');
const fs = require('fs');

const JELLYFIN_URL = 'https://juncokstreams.stream';
const JELLYFIN_API_KEY = '3d5eabb105cb406ba40fe81e5fd47059';

const logFile = fs.createWriteStream('debug_views.txt');
function log(msg) {
    console.log(msg);
    logFile.write(msg + '\n');
}

https.get(`${JELLYFIN_URL}/Items?Fields=Name,Type,CollectionType`, {
    headers: { 'Accept': 'application/json', 'X-Emby-Token': JELLYFIN_API_KEY }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        log(`Total Views: ${json.Items.length}`);
        json.Items.forEach(item => {
            log(`Name: ${item.Name}, Type: ${item.Type}, CollectionType: ${item.CollectionType}`);
        });
    });
});
