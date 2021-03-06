/* dependent packages and files required */
import fetch from 'node-fetch';
import log from './utils/logger.js';
import { get_token } from './auth_handler.js';
import config from './config/config_catchpoint.js';
import config_tsdb from './config/config_tsdb.js';
/* 

functions:
        Function Name                   Description
    fetch_Data            :     function to fetch data from LastRaw API
    convert_data          :     function to convert JSON from LastRaw API to Lines
    write_data            :     function to insert data into OpenTSDB
    get_token             :     function to get Access token 

*/

// Global Variable
const raw_data_url = `${config.base_url}${config.last_raw_path}`;
const client_key = config.client_key;
const client_secret = config.client_secret;
const test_types = config.tests;
const server = config_tsdb.tsdb_host;
const port = config_tsdb.tsdb_port;
const tsdb_url = `${server}:${port}/api/put?summary`;
const prefix = "catchpoint.testdata."

// main function to fetch and store data
async function run() {
    try {
        let token = await get_token(client_key, client_secret);
        let tests_list = [];
        // breakdown the tests list into chunks of 50 test ids for each test type
        Object.keys(test_types).forEach(function (key, index) {
            let temp = [], chunk = 50;
            for (let i = 0, j = test_types[key].length; i < j; i += chunk) {
                temp.push(test_types[key].slice(i, i + chunk));
            }
            tests_list.push(temp);
        });
        for (let tests of tests_list) {
            for (let arr of tests) {
                let url = `${raw_data_url}${arr}`;
                let raw_data = await fetch_Data(token, url);
                let data = convert_data(raw_data);
                if (data != "No Data") {
                    let i, batch, batch_size = 50;
                    // Process batches of 50 datapoints
                    log.info("<<#Datapoints>>", data.length);
                    for (i = 0; i < data.length; i += batch_size) {
                        batch = data.slice(i, i + batch_size);
                        write_data(batch)
                    }
                }
                else {
                    log.info("No Data for the last 15 minutes");
                }
            }
        }
    }
    catch (err) {
        let error = new Error(err);
        log.error(error);
    }
}
// function to fetch Raw Data
async function fetch_Data(token, url) {
    let response = await fetch(url, {
        headers: {
            'accept': 'application/json',
            'authorization': `Bearer ${token}`
        }
    })
        .then(res => res.json())
        .then(json => {
            // if object has property Message, display Error, else Process Data
            if (json.hasOwnProperty('Message')) {
                log.error(`${json.Message}`);
            } else {
                log.info("<<Fetched Raw Test Data>>", url, `Raw Data Start Timestamp: ${json.start} End Timestamp: ${json.end}`)
                if (json.hasOwnProperty('error')) {
                    log.error(`${json.error}`, "<<Check Catchpoint configuration file>>")
                }
                return json;
            }
        }).catch(err => {
            log.error(err);
        }
        );
    return response;
}
// function to parse and convert JSON to lines
function convert_data(structure) {
    // Checks if there is test data for the last 15 mins
    if (structure['detail'] != null) {
        const char_map = { '#': 'numOf', '%': 'percent', '(': '.', ')': '', ' ': '' };
        let items = []
        let test_params = []
        let test_metric_values = []
        let temp = {}
        let solution = {}
        let lines = []
        for (let value of structure?.detail?.fields?.synthetic_metrics) {
            let metrics = value['name'].replace(/[#(%) ]/g, function (m) { return char_map[m] }); //remove whitespace,special characters from metric names
            test_params.push(metrics)
        }
        for (let value of structure?.detail?.items) {
            let metric_values = value['synthetic_metrics']
            let flag = true
            let temp = {}
            temp.tags = {}
            temp.data_timestamp = {}
            for (let i in value) {
                if (i != 'synthetic_metrics') {
                    switch (i) {
                        case "dimension":
                            temp.data_timestamp = value[i]['name']
                            break;
                        case "breakdown_1":
                            temp.tags['TestId'] = value[i]['id']
                            break;
                        case "breakdown_2":
                            temp.tags['NodeId'] = value[i]['id']
                            break;
                        case "hop_number":
                            temp.tags['HopNumber'] = value[i]
                            break;
                        case "step":
                            temp.tags['StepNumber'] = value[i]
                            break;
                    }
                }
            }
            if (flag) {
                metric_values.push(temp)
                test_metric_values.push(metric_values)
            }
        }
        for (let test_metric_value of test_metric_values) {
            temp = {}
            temp.fields = {}
            for (let i = 0; i < test_metric_value.length; i++) {
                if (typeof (test_metric_value[i]) != "object")
                    temp.fields[test_params[i]] = test_metric_value[i]
                else
                    for (let value in test_metric_value[i]) {
                        temp[value] = test_metric_value[i][value]
                    }
            }
            items.push(temp)
        }
        solution['items'] = items

        for (let item of solution['items']) {
            for (let metric in item['fields']) {
                let line = {
                    metric: prefix + metric,
                    timestamp: Math.round(new Date(item['data_timestamp']).getTime() / 1000), //Epoch time in seconds precision
                    value: item['fields'][metric],
                    tags: item['tags']
                }
                lines.push(line)
            }
        }
        return lines;
    }
    else {
        log.info(structure)
        return ("No Data");
    }
}
//function to send datapoints to Opentsdb api for storage
function write_data(data) {
    let data_points = JSON.stringify(data);
    log.info("<<Posting data to TSDB API in batches of 50 datapoints>>")
    fetch(tsdb_url,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data_points
        })
        .then(res => {
            log.info(res.status, res.statusText);
        })
        .catch(err => {
            log.error(err);
        });
}
//Run the main function
//var interval=setInterval(run,900000)
run();
