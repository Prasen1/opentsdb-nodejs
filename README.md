# Opentsdb-Node.js

## Installation and Configuration
1. Copy the opentsdb-nodejs folder to your machine
2. Run npm install in the directory /opentsdb-nodejs



    opentsdb-nodejs/
    ├── auth_handler.js       ## Contains APIs related to authentication       
    ├── config
    | ├── config_catchpoint.js   ## Configuration file for Catchpoint 
    | ├── config_tsdb.js     ## Configuration file for openTSDB
    ├── logs
    | ├── info
    | |  ├── info.log         ## Contains informational logs. File name will be based on date of execution
    | ├── error
    | |  ├── error.log        ## Contains error logs. File name will be based on date of execution          
    ├── utils
    | ├── logger.js           ## logger utility
    ├──package.json           ## project dependencies
    └── insert_db.js          ## main file
