#!/usr/bin/env bash
echo "=========================================================="
echo "Starting Drupal Notes Web Application Development Server..."
echo "Access the app at: http://127.0.0.1:8080/notes (or http://127.0.0.1:8080/)"
echo "Admin panel (Credentials: admin / admin): http://127.0.0.1:8080/user"
echo "Press Ctrl+C to stop the server."
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/drupal-app/web"

NIXPKGS_ALLOW_UNFREE=1 nix develop "$SCRIPT_DIR" --impure -c php -S 127.0.0.1:8080 .ht.router.php
