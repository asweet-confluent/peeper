#!/usr/bin/env bash

convert peeper-source.png -resize 256x256 icon.ico

# Create macOS ICNS (on macOS)
mkdir icon.iconset
for size in 16 32 64 128 256 512; do
  convert peeper-source.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
done

# iconutil -c icns icon.iconset
png2icns icon.icns icon.iconset/*
rm -rf icon.iconset

# Create dmg background image
convert peeper-source.png -resize 540x380 -background transparent -compose Copy \
  -gravity center -extent 540x380 dmg-background.png

# Create Linux PNG icons
mkdir -p icons
for size in 16 32 48 64 128 256 512; do
  convert peeper-source.png -resize ${size}x${size} icons/${size}x${size}.png
done

