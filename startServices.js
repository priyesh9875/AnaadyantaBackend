var firebase = require('firebase-admin');
var request = require('request');
var moment = require('moment');
var config = require('./config.json')
var nodemailer = require("nodemailer");
var fs = require('fs')
  , Log = require('log')
  , FCMlog = new Log('info', fs.createWriteStream(__dirname + '/FCMlog.txt', { flags: 'a' }))
  , Reglog = new Log('info', fs.createWriteStream(__dirname + '/Registrationlog.txt', { flags: 'a' }));


FCMlog.info("=================================")
FCMlog.info("Server restarted")
FCMlog.info("=================================")



Reglog.info("=================================")
Reglog.info("Server restarted")
Reglog.info("=================================")


var API_KEY = config.API_KEY; // Your Firebase Cloud Messaging Server API key

// Fetch the service account key JSON file contents
var serviceAccount = require("./serviceAccount.json");

// Initialize the app with a service account, granting admin privileges
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: config.databaseURL
});

ref = firebase.database().ref();
// FCM Notification 
function listenForNotificationRequests() {
  FCMlog.info("Ready for listening")
  var requests = ref.child('feeds');
  requests.on('child_added', function (requestSnapshot) {
    var feeds = requestSnapshot.val();
    if (feeds.time > (moment().unix() - 600)) {
      // Push only feeds which are new or at most 10 minutes old
      sendNotification(feeds.to, feeds.title, feeds.description)
    } else {
      FCMlog.info("Outdated: %s", feeds.title)
      console.log("[" + moment().format() + "] Outdated: ", feeds.title)
    }
  }, function (error) {
    FCMlog.error(error)
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
      FCMlog.error("HTTP error: %s - %s", response.statusCode, response.statusMessage)
      console.log('HTTP Error: ' + response.statusCode + ' - ' + response.statusMessage);
    } else {
      FCMlog.info("Pushed: %s: %s", to, title)
      console.log("[" + moment().format() + "] Pushed: ", to, ":", title)
    }
  });
}


// Registration 

let selfSignedConfig = {
  host: config.host,
  port: config.port,
  secure: true, // use TLS
  auth: {
    user: config.username,
    pass: config.password
  },
  tls: {
    rejectUnauthorized: false
  }
};

var transporter = nodemailer.createTransport(selfSignedConfig)


function sendRegistrationMail(to, eventTitle, name) {
  var message = {
    from: 'Anaadyanta Team registration@anaadyanta.org',
    replyTo: 'registration@anaadyanta.org',
    bcc: 'registration@anaadyanta.org',
    to: to || "appteam17@anaadyanta.org",
    subject: `Registration for ${eventTitle} `,
    html: `
            <div style="background-color:'white; padding-left: 20px; padding-top: 20px; padding-bottom: 20px; padding-right: 20px">
                <h1>Hello <i>${name || "User"}!</i></h1>

                <img alt="${eventTitle}" src="http://www.onspon.com/event/pics/1565306216whatsappimage2017-01-06at12.00.24am(1).jpeg" style="width: 100%"/>
                <p>Thank you for showing interest in <b>${eventTitle}</b> at Anaadyanta 2017. You have now successfully registered for the event. 

                <p>What's next?</p>
                <ul>
                    <li>Check out our website just before 9th March 2017 to get the final schedule of the events.</li>
                    <li>Please arrive at least <b>1 hour</b> before the scheduled time of the event.</li>
                    <li>Pay the registration fee at registration desk and collect your entry ticket.</li>
                    <li>Participate in the events!Enjoy:)</li>
                </ul>

                <p>Hope to see you soon.</p>
                <p>All the best!</p>


                <p>Yours,<br/><b>Team Anaadyanta 2017</b></p>
            </div>

            <p>For further details, Contact us at:</p>
            <p><a href="mailto:info@anaadyanta.org">info@anaadyanta.org</a></p>
            
            <p style="text-align:'center'">https://github.com/priyesh9875/anaadyanta</p>
        `,

  };

  transporter.sendMail(message, function (err, info) {
    if (err) {
      // check if htmlstream is still open and close it to clean up
      Reglog.error(`Mail send error: ${eventTitle}: ${to}`)
    } else {
      Reglog.error(`Mail sent: ${eventTitle} -> ${to}`)
      console.log(`[${moment().format()}] Mail sent: ${eventTitle} -> ${to}`)
    }
  });

}

function listenForRegisterationRequests() {
  var requests = ref.child('registration');
  Reglog.info("Listening for registrations")
  console.log("Listening for registrations")

  requests.on('child_added', function (requestSnapshot) {
    var child = requestSnapshot.val();
    // If registertion is older than 10 minutes, dont send
    if (child.date > (moment().unix() - 600)) {
      sendRegistrationMail(child.email, child.event, child.name)
    } else {
      Reglog.error(`Outdated:  ${child.event} -> ${child.email}`)
      console.log(`[${moment().format()}]  Outdated: ${child.event} -> ${child.email}`)
    }
  }, function (error) {
    console.log(error)
  });
};

// Verify and start registertion service
transporter.verify(function (error, success) {
  if (error) {
    console.log(error);
  } else {
    console.log('Server is ready to take our messages');
    listenForRegisterationRequests()
  }
});


// Start FCM service
listenForNotificationRequests();
console.log("Server started")
