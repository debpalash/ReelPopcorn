.PHONY: run check package player
player:
	npm run build:player
run: player
	nsh run --target macos --window-size 1100x740
check: player
	nsh check
	nsh build
	nsh test
	node scripts/test-player.mjs
	node scripts/test-startup.mjs
package: player
	nsh package --target macos --out dist
