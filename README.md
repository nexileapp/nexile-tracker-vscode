# Nexile Tracker for VS Code

Track your coding time and development activities directly within VS Code. Get detailed insights into your productivity and project time allocation through seamless integration with the Nexile desktop app.

## Features

- **Automatic Time Tracking**: Automatically tracks your coding time and activity while you work
- **Project-Based Tracking**: Separate time tracking for different workspaces and projects
- **Activity Detection**: Smart detection of coding, debugging, and idle time
- **Status Bar Integration**: Quick access to your tracked time and extension controls
- **Desktop App Integration**: Syncs with Nexile desktop app for comprehensive time analytics

### Command Palette Integration

Access all features through the command palette (`Ctrl/Cmd + Shift + P`):

- `Nexile Tracker: Open Dashboard` - Open the Nexile web dashboard
- `Nexile Tracker: Toggle Enable/Disable` - Enable or disable tracking globally
- `Nexile Tracker: Toggle Enable/Disable for Current Workspace` - Control tracking per workspace

## Requirements

- [Nexile Desktop App](https://nexile.app/desktop) installed and running

## Installation

1. Install the extension from the VS Code Marketplace
2. Install the [Nexile Desktop App](https://nexile.app/desktop)
3. Launch the desktop app
4. Start coding - tracking begins automatically!

## Extension Settings

This extension contributes the following settings:

- `nexile-tracker.enabled`: Enable/disable the extension globally
- `nexile-tracker.disabledWorkspaces`: List of workspaces where tracking is disabled

## Troubleshooting

### Common Issues

1. **"Desktop app must be running" error**

   - Ensure the Nexile desktop app is installed and running

2. **Time not updating**

   - Check if the extension is enabled
   - Verify the desktop app connection
   - Ensure the workspace isn't disabled

3. **Activity not being tracked**
   - Check the status bar indicator
   - Ensure you're not in an ignored workspace
   - Verify VS Code has focus

## Release Notes

### 1.0.0

Initial release of Nexile Tracker for VS Code:

- Automatic time tracking
- Desktop app integration
- Project-based tracking
- Activity detection
- Status bar integration
- Command palette integration

## Support

Need help? Visit our [support page](https://nexile.app/support) or contact us at support@nexile.app.
