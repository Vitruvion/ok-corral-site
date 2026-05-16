# Apple Wallet pass images

Drop the .pkpass icon assets here. See `docs/apple-wallet-setup.md` for sizes.

| File              | Size      | Status      |
| ----------------- | --------- | ----------- |
| `icon.png`        | 29×29     | required    |
| `icon@2x.png`     | 58×58     | recommended |
| `icon@3x.png`     | 87×87     | recommended |
| `logo.png`        | 160×50    | optional    |
| `logo@2x.png`     | 320×100   | optional    |
| `strip.png`       | 375×123   | optional    |
| `strip@2x.png`    | 750×246   | optional    |

The signer reads files from this directory at request time — no rebuild
needed when you swap an image.
