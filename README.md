
# VEXSTORM_HACKATHON - ZeroTrace

ZeroTrace is a multi-agent AI security scanner powered by LangGraph and Mistral. It is designed to analyze code for security vulnerabilities and provide detailed reports. This project is a monorepo containing the frontend, backend, and a VS Code extension.

## Project Structure

The project is divided into three main parts:

-   `client/`: A React-based frontend for the ZeroTrace dashboard.
-   `server/`: An Express.js backend that powers the dashboard and manages security scans.
-   `extension/`: A VS Code extension that allows developers to run security scans directly from their editor.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher recommended)
-   [npm](https://www.npmjs.com/)
-   [VS Code](https://code.visualstudio.com/)

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/VEXSTORM_HACKATHON.git
    cd VEXSTORM_HACKATHON
    ```

2.  **Install dependencies for all packages:**

    ```bash
    # From the root directory
    npm install
    cd client && npm install
    cd ../server && npm install
    cd ../extension && npm install
    ```

### Running the Application

1.  **Start the backend server:**

    ```bash
    cd server
    npm run dev
    ```

    The server will start on `http://localhost:5000`.

2.  **Start the frontend client:**

    ```bash
    cd client
    npm run dev
    ```

    The client will be available at `http://localhost:5173`.

3.  **Run the VS Code extension:**
    -   Open the `extension` folder in VS Code.
    -   Press `F5` to run the extension in a new Extension Development Host window.
    -   Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to access the `ZeroTrace` commands.

## VS Code Extension (`extension/`)

The ZeroTrace VS Code extension provides a seamless way to scan your code for security vulnerabilities without leaving your editor.

### Features

-   **Run Security Scans:** Scan your entire workspace or a specific folder.
-   **Dashboard Integration:** Connect to the ZeroTrace dashboard to view and manage scan reports.
-   **Configuration:** Customize scan settings, such as file extensions to scan and file size limits.

### Commands

-   `ZeroTrace: Run Security Scan on Folder`: Initiates a scan on a selected folder.
-   `ZeroTrace: Scan Currently Open Workspace`: Scans the entire open workspace.
-   `ZeroTrace: Connect to Dashboard (Sign In)`: Connects the extension to your ZeroTrace dashboard account.
-   `ZeroTrace: Disconnect from Dashboard (Sign Out)`: Disconnects the extension from the dashboard.
-   `ZeroTrace: Upload Existing HTML Report to Dashboard`: Uploads a previously generated HTML report to the dashboard.
-   `ZeroTrace: Check Dashboard Connection Status`: Checks the connection status with the dashboard.

### Configuration

You can configure the extension's settings in VS Code's `settings.json` file.

-   `zerotrace.mistralApiKey`: Your Mistral API key.
-   `zerotrace.mistralModel`: The Mistral model to use for analysis.
-   `zerotrace.maxFileSizeKB`: The maximum file size (in KB) to scan.
-   `zerotrace.fileExtensions`: An array of file extensions to include in scans.
-   `zerotrace.dashboardUrl`: The URL of the ZeroTrace dashboard.
-   `zerotrace.dashboardEmail`: Your dashboard login email.
-   `zerotrace.dashboardPassword`: Your dashboard login password.

## Backend (`server/`)

The backend is a Node.js application using Express.js. It handles user authentication, manages security scans, and serves the ZeroTrace dashboard API.

### Key Technologies

-   **Express.js**: Web framework for Node.js.
-   **Mongoose**: MongoDB object modeling for Node.js.
-   **JWT**: JSON Web Tokens for authentication.
-   **Mistral AI**: For AI-powered security analysis.

## Frontend (`client/`)

The frontend is a React application built with Vite. It provides a user-friendly interface for viewing security scan reports and managing project settings.

### Key Technologies

-   **React**: A JavaScript library for building user interfaces.
-   **Vite**: A fast build tool for modern web projects.
-   **Tailwind CSS**: A utility-first CSS framework.
-   **React Router**: For routing in the React application.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License.
