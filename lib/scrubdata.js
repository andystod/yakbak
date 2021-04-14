// Copyright 2016 Yahoo Inc.
// Licensed under the terms of the MIT license. Please see LICENSE file in the project root for terms.

var Promise = require('bluebird');
var debug = require('debug')('yakbak:scrubdata');
var jsonpath = require('jsonpath');
var faker = require('faker');


var sensitiveData = {
    "ConfigurationHelper_GetAppLaunchSettings":
    [{
        "jsonpath": "$..feature",
        "replaceValue": "{{address.city}}"
    },
    {
        "jsonpath": "$..id",
        "replaceValue": ['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd']
    },
    {
        "jsonpath": "$..currentDateTime",
        "replaceValue": 12345
    }
    ]
};


module.exports = function (req, res, body) {

    // TODO: move this to function and call only where it is required
    var bodyString = Buffer.concat(body).toString();
    var bodyStringObj;

    var urlParts = req.url.toString().split('/');

    debug('url', req.url);

    if (urlParts[urlParts.length - 3] !== 'oauth') {
        service = urlParts[urlParts.length - 2];
        method = urlParts[urlParts.length - 1];
        var serviceMethodIdentifier = service + '_' + method;

        if (sensitiveData.hasOwnProperty(serviceMethodIdentifier)) {
            var serviceMethodSensitiveData = sensitiveData[serviceMethodIdentifier];
            bodyStringObj = JSON.parse(bodyString)

            serviceMethodSensitiveData.forEach(function (val) {
                var bodyStringObjPaths = jsonpath.apply(bodyStringObj, val.jsonpath, function (value) { return replaceValue(val.replaceValue) });
            });
        }
        else {
            console.log('not hasOwnProperty');
        }
    }
    else {
        console.log('oauth');
        return body;
    }

    console.log('body post-scrub:' + bodyStringObj);
    console.log('body post-scrub str: ' + JSON.stringify(bodyStringObj));

    // TODO: write bodyStringObj out to buffer again

    return body;
}

function replaceValue(val) {
    // Faker
    if (typeof val === 'string' && val.substr(0, 2) === '{{') {
        return faker.fake(val);
    }
    // Return random item in array
    else if (Array.isArray(val)) {
        return val[getRandomInt(0, val.length)];
    }
    else {
        return val;
    }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}