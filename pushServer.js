var firebase = require('firebase-admin');
var request = require('request');
var moment = require('moment');
var config = require('./config.json')
var fs = require('fs')
  , Log = require('log')
  , log = new Log('info', fs.createWriteStream(__dirname + '/log.txt', { flags: 'a' }));


log.info("=================================")
log.info("Server restarted")
log.info("=================================")

var API_KEY = config.API_KEY; // Your Firebase Cloud Messaging Server API key

// Fetch the service account key JSON file contents
var serviceAccount = require("./serviceAccount.json");

// Initialize the app with a service account, granting admin privileges
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: config.databaseURL
});

ref = firebase.database().ref();

function listenForNotificationRequests() {
  var requests = ref.child('feeds');
  requests.on('child_added', function (requestSnapshot) {
    var feeds = requestSnapshot.val();
    if (feeds.time > (moment().unix() - 600)) {
      // Push only feeds which are new or at most 10 minutes old
      sendNotification(feeds.to, feeds.title, feeds.description)
    } else {
      //log.info("Outdated: %s", feeds.title)
      //console.log("[" + moment().format() + "] Outdated: ", feeds.title)
    }
  }, function (error) {
    log.error(error)
  });
};

function sendNotification(to, title, body) {
  request({
    url: 'https://fcm.googleapis.com/fcm/send',
    method: 'POST',
    headers: {
      'Content-Type': ' application/json',
      'Authorization': 'key=' + API_KEY
    },
    body: JSON.stringify({
      notification: {
        title,
        body,
        "sound": "default",
        "click_action": "fcm.ACTION.HELLO"
      },
      to
    })
  }, function (error, response, body1) {
    if (error) { console.error(error); }
    else if (response.statusCode >= 400) {
      log.error("HTTP error: %s - %s", response.statusCode, response.statusMessage)
      console.error('HTTP Error: ' + response.statusCode + ' - ' + response.statusMessage);
    } else {
      log.info("Pushed: %s: %s", to, title)
      console.log("[" + moment().format() + "] Pushed: ", to, ":", title)
    }
  });
}

// start listening
listenForNotificationRequests();
console.log("Server started")
