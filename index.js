const api = require('./src/api');
api(__dirname).catch(error => {
    console.error(error);
    require('process').exitCode = 1;    
});
