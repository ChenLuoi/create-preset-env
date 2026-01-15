export default {
    target: ".env.local",
    overrideDescription: true,
    variables: {
        "API_BASE": "https://api.example.com",
        "CDN_BASE": "https://cdn.example.com",
        "MULTILINE_KEY": "LINE1\nLINE2",
        "OBJECT_KEY": {
            value: "object value",
            description: "This is a object style definition"
        },
        "NUMBER_KEY": {
            "value": 3040,
            "description": "This is a number"
        },
        "CONFIG_FROM_JS": {
            "value": true,
            "description": "This is config defined in env.config.js"
        }
    }
}
