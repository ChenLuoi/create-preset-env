# create-preset-env

A tool to help create env file

## Install
```bash
npm install create-preset-env
```

## Add to package.json
```json
{
  "script": {
    "prepare": "create-preset-env"
  }
}
```
## Add configuration file
create a new file named `env.config.json`. This is a example file

```json
{
    "target": ".env.local",
    "overrideDescription": true,
    "variables": {
        "API_BASE": "https://api.example.com",
        "CDN_BASE": "https://cdn.example.com",
        "MULTILINE_KEY": "LINE1\nLINE2",
        "OBJECT_KEY": {
            "value": "object value",
            "description": "This is a object style definition"
        },
        "NUMBER_KEY": {
            "value": 3040,
            "description": "This is a number"
        }
    }
}
```

After npm install, a new file .env.local will be auto generated at project root.
```ini
API_BASE=https://api.example.com
CDN_BASE=https://cdn.example.com
MULTILINE_KEY="LINE1\nLINE2"
# This is a object style definition
OBJECT_KEY=object value
# This is a number
NUMBER_KEY=3040
```
