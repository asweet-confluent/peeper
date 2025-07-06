# Build Resources

This directory contains assets used for building the application:

## Icons

Place your application icons in the following formats:

- `icon.ico` - Windows icon (256x256 or higher)
- `icon.icns` - macOS icon bundle
- `icons/` - Directory containing Linux icons in various sizes:
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

## DMG Background (macOS)

- `dmg-background.png` - Background image for macOS DMG installer (540x380 or 1080x760 for Retina)

## Icon Requirements

### Windows (.ico)
- Should contain multiple sizes: 16, 32, 48, 64, 128, 256 pixels
- Can be created from a PNG using online converters or tools like ImageMagick

### macOS (.icns)
- Should contain multiple sizes: 16, 32, 64, 128, 256, 512, 1024 pixels
- Can be created using Xcode or tools like `iconutil` on macOS

### Linux (.png)
- Multiple PNG files in different sizes in the `icons/` subdirectory
- Common sizes: 16, 32, 48, 64, 128, 256, 512 pixels

## Creating Icons from a Source Image

If you have a high-resolution source image (e.g., 1024x1024 PNG), you can use these tools:

### Using ImageMagick (cross-platform)
```bash
# Install ImageMagick first
# Create Windows ICO
magick peeper-source.png -resize 256x256 icon.ico

# Create macOS ICNS (on macOS)
mkdir icon.iconset
for size in 16 32 64 128 256 512; do
  magick peeper-source.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
done
iconutil -c icns icon.iconset

# Create Linux PNG icons
mkdir -p icons
for size in 16 32 48 64 128 256 512; do
  magick peeper-source.png -resize ${size}x${size} icons/${size}x${size}.png
done
```

### Online Tools
- **Favicon.io** - Convert PNG to ICO
- **CloudConvert** - Multi-format icon conversion
- **IconArchive** - Icon creation tools

## Note

The current setup uses placeholder paths. Make sure to:

1. Create your application icons and place them in this directory
2. Update the paths in `electron-builder.mjs` if you use different filenames
3. Test the build process to ensure icons are correctly embedded
