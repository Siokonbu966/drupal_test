#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRUPAL_APP_DIR="$SCRIPT_DIR/drupal-app"
SETTINGS_FILE="$DRUPAL_APP_DIR/web/sites/default/settings.php"
DEFAULT_SETTINGS_FILE="$DRUPAL_APP_DIR/web/sites/default/default.settings.php"
SQLITE_DIR="$DRUPAL_APP_DIR/web/default/files"

echo "=========================================================="
echo "Setting up Drupal Notes Web Application environment..."
echo "=========================================================="

# 1. Create SQLite directory and set permissions
echo "Creating SQLite directory..."
mkdir -p "$SQLITE_DIR"
chmod 775 "$SQLITE_DIR"
echo "Directory created: $SQLITE_DIR"

# 2. Create settings.php if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "Creating settings.php from template..."
    cp "$DEFAULT_SETTINGS_FILE" "$SETTINGS_FILE"
    chmod 664 "$SETTINGS_FILE"
    
    # Generate a random hash salt
    HASH_SALT=$(openssl rand -base64 32 2>/dev/null || echo "random_fallback_hash_salt_$(date +%s)")
    
    echo "Appending database and hash salt configuration to settings.php..."
    cat << EOF >> "$SETTINGS_FILE"

// --- Custom SQLite Configuration added by setup.sh ---
\$databases['default']['default'] = array (
  'database' => 'default/files/.ht.sqlite',
  'prefix' => '',
  'driver' => 'sqlite',
  'namespace' => 'Drupal\\\\sqlite\\\\Driver\\\\Database\\\\sqlite',
  'autoload' => 'core/modules/sqlite/src/Driver/Database/sqlite/',
);

\$settings['hash_salt'] = '$HASH_SALT';
\$settings['config_sync_directory'] = 'sites/default/files/config_sync';
EOF
    echo "settings.php configured successfully."
else
    echo "settings.php already exists. Skipping configuration."
fi

# 3. Inform about composer install
echo "=========================================================="
echo "Setup completed successfully!"
echo "Next step: Run 'composer install' inside 'drupal-app' directory"
echo "or run with nix: 'nix develop --impure -c composer --working-dir=drupal-app install'"
echo "Then, start the server using './run-server.sh'"
echo "=========================================================="
