.PHONY: run check package release player
TARGET ?= macos
player:
	npm run build:player
run: player
	nsh run --target $(TARGET) --window-size 1100x740
check:
	node scripts/check.mjs
package: player
	nsh package --target $(TARGET) --out dist
release:
	node scripts/package-desktop.mjs
