# Azure DevOps Migration Tool

A comprehensive enterprise-grade tool for extracting and migrating projects between Azure DevOps organizations. Built with Python FastAPI backend and React frontend.

## Features

- **Project Synchronization**: Connect to Azure DevOps organizations and sync project metadata
- **Artifact Extraction**: Extract work items, repositories, pipelines, test plans, boards, and queries
- **Migration Management**: Track migration progress with detailed audit logs
- **Real-time Monitoring**: Live dashboard showing extraction and migration status
- **Enterprise Security**: Secure PAT token authentication and encrypted data handling

## Prerequisites

### Required Software
- **Python 3.11+** - Backend runtime
- **Node.js 18+** - Frontend build tools and React development
- **PostgreSQL 14+** - Primary database for storing migration data
- **Git** - Version control (for cloning repository)

### Azure DevOps Requirements
- Valid Azure DevOps organization access
- Personal Access Token (PAT) with following permissions:
  - Code (read)
  - Work items (read)
  - Build (read)
  - Test management (read)
  - Project and team (read)

## Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd azure-devops-migration-tool
```

### 2. Database Setup

#### Option A: Using Replit (Recommended)
If running on Replit, PostgreSQL is automatically provisioned. The connection details are available as environment variables.

#### Option B: Local PostgreSQL
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE ado_migration;
CREATE USER ado_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ado_migration TO ado_user;
\q
```

### 3. Environment Configuration

Create environment variables for your setup:

```bash
# Database Configuration (if not using Replit)
export DATABASE_URL="postgresql://ado_user:your_password@localhost:5432/ado_migration"
export PGHOST="localhost"
export PGPORT="5432"
export PGDATABASE="ado_migration"
export PGUSER="ado_user"
export PGPASSWORD="your_password"

# Azure DevOps Configuration
export AZURE_DEVOPS_PAT="your_pat_token_here"
```

### 4. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Initialize database tables
python backend/init_db.py

# Start the Python FastAPI backend
python backend/main.py
```

The backend will run on `http://localhost:5000`

### 5. Frontend Setup

```bash
# Install Node.js dependencies
npm install

# Start the React development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Getting Azure DevOps PAT Token

### Step 1: Access Azure DevOps
1. Navigate to your Azure DevOps organization: `https://dev.azure.com/{your-organization}`
2. Click on your profile picture in the top right
3. Select "Personal access tokens"

### Step 2: Create New Token
1. Click "New Token"
2. Set the following configuration:
   - **Name**: "Migration Tool Access"
   - **Organization**: Select your organization or "All accessible organizations"
   - **Expiration**: Set appropriate expiration date
   - **Scopes**: Select "Custom defined" and check:
     - Code (Read)
     - Work Items (Read)
     - Build (Read)
     - Test Management (Read)
     - Project and Team (Read)

### Step 3: Save Token
1. Click "Create"
2. **Important**: Copy the token immediately - it won't be shown again
3. Set it as the `AZURE_DEVOPS_PAT` environment variable

## Configuration

### Backend Configuration
The Python backend automatically configures itself using environment variables. Key settings:

- **Database**: Uses `DATABASE_URL` or individual PostgreSQL environment variables
- **Azure DevOps**: Connects to organization using `AZURE_DEVOPS_PAT` token
- **Port**: Runs on port 5000 by default

### Frontend Configuration
The React frontend connects to the backend API and provides:

- Project selection and filtering
- Real-time sync with Azure DevOps
- Extraction job monitoring
- Migration progress tracking
- Audit log viewing

## Usage

### 1. Start the Application
```bash
# Terminal 1: Start backend
python backend/main.py

# Terminal 2: Start frontend
npm run dev
```

### 2. Sync Projects
1. Open the application in your browser
2. Navigate to "Project Selection"
3. Click "Sync Projects" to fetch projects from Azure DevOps
4. Projects will appear in the table with their metadata

### 3. Select Projects for Migration
1. Use checkboxes to select projects
2. Apply filters by process template or visibility
3. Click "Start Extraction" for selected projects

### 4. Monitor Progress
1. Navigate to "Extraction Overview" to see job progress
2. Check "Audit Logs" for detailed operation logs
3. View "Statistics" for overall migration metrics

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects/sync` - Sync projects from Azure DevOps
- `POST /api/projects/bulk-status` - Update multiple project statuses
- `POST /api/projects/extract` - Start extraction jobs

### Statistics
- `GET /api/statistics` - Get migration statistics

### Jobs & Logs
- `GET /api/jobs` - List extraction jobs
- `GET /api/logs` - Get audit logs

## Database Schema

The tool uses a comprehensive 20-table PostgreSQL schema:

### Core Tables
- `projects` - Project metadata and status
- `ado_connections` - Azure DevOps connection details
- `extraction_jobs` - Job tracking and progress
- `audit_logs` - Operation audit trail

### Artifact Tables
- `work_items` - Work item data
- `repositories` - Repository information
- `pipelines` - Build pipeline definitions
- `test_plans` - Test management data

## Troubleshooting

### Common Issues

#### 1. "Connection not found" Error
**Cause**: Missing or invalid Azure DevOps connection
**Solution**: 
- Verify `AZURE_DEVOPS_PAT` environment variable is set
- Check token permissions and expiration
- Ensure organization name is correct

#### 2. Database Connection Failed
**Cause**: PostgreSQL not accessible or incorrect credentials
**Solution**:
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check connection string format
- Ensure database exists and user has permissions

#### 3. Sync Projects 404 Error
**Cause**: Backend not running or wrong endpoint
**Solution**:
- Confirm Python backend is running on port 5000
- Check backend logs for errors
- Verify frontend is connecting to correct API URL

#### 4. CORS Errors
**Cause**: Frontend and backend on different origins
**Solution**:
- Ensure both services are running on localhost
- Backend includes CORS middleware for development

#### 5. "No projects found" After Sync
**Cause**: Azure DevOps permissions or empty organization
**Solution**:
- Verify PAT token has "Project and team (read)" permission
- Check if organization contains accessible projects
- Review Azure DevOps organization membership

### Debug Mode

Enable debug logging in the backend:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Log Files
- Backend logs: Console output from `python backend/main.py`
- Database logs: Check PostgreSQL logs in `/var/log/postgresql/`
- Frontend logs: Browser developer console

## Development

### Project Structure
```
azure-devops-migration-tool/
├── backend/                 # Python FastAPI backend
│   ├── api/                # API route handlers
│   ├── database/           # Database models and connection
│   ├── services/           # Business logic services
│   └── main.py            # Application entry point
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utilities and API client
└── shared/                # Shared TypeScript schemas
```

### Adding New Features
1. Define database schema changes in `backend/database/models.py`
2. Create API endpoints in `backend/api/`
3. Add frontend components in `client/src/`
4. Update shared types in `shared/schema.ts`

## Security Considerations

- PAT tokens are stored securely as environment variables
- Database connections use encrypted PostgreSQL connections
- No sensitive data is logged or exposed in API responses
- Regular token rotation is recommended

## Support

For issues and questions:
1. Check this documentation first
2. Review application logs for error details
3. Verify environment configuration
4. Ensure all prerequisites are met

## License

This project is licensed under the MIT License.