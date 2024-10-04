const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const players = [];
const interval = 5000;
const https = require('https');
fs.createReadStream('/usr/local/var/www/cmw-playerinfo-api/Playersinfo.csv')
    .pipe(csv())
    .on('data', async function (data) {
        const sanitizedData = Object.fromEntries(
            Object.entries(data).map(([key, value]) => [
                key.replace(/[\s']/g, ''),
                value === '' ? '' : value
            ])
        );
        players.push(JSON.stringify({
            'player_token': sanitizedData.player_token,
        }));
    })
    .on('end', () => {
        players.forEach((item, index) => {
            setTimeout(async () => {
                await requestVitruvian(item)
                    .then(async function (response) {
                        console.log(response);
                    }).catch(async function (err) {
                        console.log(err);
                    }).finally(async function () {

                    })

            }, index * interval);
        });
    })
    .on('error', (err) => {
        console.log(err);
    });


async function requestVitruvian(item) {
    const parsedData = JSON.parse(item);
    const playerToken = parsedData.player_token;


    return new Promise(async (resolve, reject) => {

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://afun-playerinfo-ap-prod.vitruviandata.com/player?token=${playerToken}`,
            headers: {
                'Authorization': 'Basic bmltYnVzOndeN3FCUCpOJlRaZQ=='
            },
            timeout: 60000,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            })
        };

        const requestVitruvian = async (attempt) => {
            setTimeout(async () => {
                try {
                    const response = await axios(config);
                    if (response.data.results.length === 0) {
                        reject('Invalid {PlayerToken}');
                    } else {
                        resolve({
                            'playertoken': playerToken,
                            'info': response.data.results[0].info,
                            'profile': response.data.results[0].profile,
                            'tags': response.data.results[0].tags
                        });
                    }
                } catch (error) {
                    if (error.code === 'ECONNABORTED') {
                        reject('Request Timeout From Vitruvian');
                    }
                    else if (error.code === 'ERR_BAD_RESPONSE') {

                        if (attempt < retries) {
                            setTimeout(async function () {
                                console_log(`Retrying... Attempt on Token : ${token} Attempt : ${attempt + 1}`);
                                await requestVitruvian(attempt + 1);
                            }, attempt * 10000);
                        } else {
                            const errorResponse = {
                                data: {
                                    success: false,
                                    error: 'Vitruvian API Service Unavailable Exceeded 1 min Request',
                                    errordata: `${retries} attempts for this request have been exhausted`
                                }
                            };
                            reject(errorResponse);
                        }
                    } else {
                        reject(error);
                    }
                }
            }, interval);
        };
        await requestVitruvian(0);
    });
}