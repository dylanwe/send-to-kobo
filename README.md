# Send to reader
VIEW LIVE: [send2kobo](https://send2kobo.herokuapp.com/)

![preview](/img/send-to-kobo.png)

A website to send epubs to your kobo ereader and transform them to kepub on request. A quick warning for the website, for the conversion of epubs to kepubs kebupify is required but Heroku(where it's deployed) doesn't allow me to install additional programs. You're still able to send .cbz files but for kindle and kepubs I would still recommend the webiste this project is based on [https://send.djazz.se/](https://send.djazz.se/).

## To run
1. This application uses the CLI of [kepubify](https://pgaskin.net/kepubify/) to transform epubs to kepubs(kobo's format).
2. To start the application all you have to do is run `npm i` to install packages and `npm run start` to start the server.
