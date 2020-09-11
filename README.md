# Pusher plugin for authentication

Pusher plugin for batching auth requests in one HTTP call.  
When subscribing to multiple private- and presence channels at once, your browser has to make an HTTP request for each channel. This plugin enables you to process multiple channel authentications within one request.

## Prerequisites

This is a plugin for the official [Pusher](http://pusher.com) JavaScript library and compatible with the latest 7.0.x release. Make sure you have a working implementation up and running.

**Notice:** This version is not compatible with Pusher 6.0 and older. Please use version [3.0](https://github.com/dirkbonhomme/pusher-js-auth/releases) of this plugin with older Pusher versions.

Documentation and configuration options are explained at the [Pusher-js Github page](https://github.com/pusher/pusher-js)

## Usage

Load the plugin after including the Pusher library

    <script src="//js.pusher.com/4.2/pusher.min.js"></script>
    <script src="lib/pusher-auth.js"></script>

This plugin is also available on npm and bower:

    npm install pusher-js-auth
    bower install pusher-js-auth

## Configuration

This plugin comes with a few extra configuration parameters. The whole list is available at the [Pusher-js Github page](https://github.com/pusher/pusher-js#configuration)

    var pusher = new Pusher(API_KEY, {
        authorizer: PusherBatchAuthorizer,
        authDelay: 200
    });

### `authorizer` (Function)

Pass the function exposed by this plugin here. It is exposed as a module export when using AMD or CommonJS, and as the `PusherBatchAuthorizer` global otherwise.

### `authDelay` (Number)

Optional, defaults to 0. Delay in milliseconds before executing an authentication request. The value can be as low as 0 when subscribing to multiple channels within the same event loop. Please note that the first authentication request is postponed anyway until the connection to Pusher succeeds.

## Server side authentication

Your authentication endpoint should be able to handle batched requests.

### Incoming post data

    socket_id   	  00000.0000000
    channel_name[0]	  private-a
    channel_name[1]	  private-b

### Expected output

    {
        "private-a": {
            "status": 200, // HTTP status codes, optional on success
            "data": {
                "auth": "xxxxxx:xxxxxxxxxxxxx"
            }
        },
        "private-b": {
            "status": 200,
            "data": {
                "auth": "xxxxxx:xxxxxxxxxxxxx"
            }
        },
        "private-c": {
            "status": 403
        }
    }
    
Use one of the [server libraries](http://pusher.com/docs/libraries) to do most of the hard work.

## Example implementation

Copy `app_key.example.js` and `app_key.example.php` to `app_key.example.xx` and fill in your own Pusher data. Create a small PHP server and run index.html with your browser's debug console active.
