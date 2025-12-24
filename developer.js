const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const apiKeyManager = require('./apikey');

// Database paths
const DB_DIR = path.join(__dirname, 'database');
const UNIVERSITIES_DIR = path.join(DB_DIR, 'universities');
const ACCOUNTS_DIR = path.join(DB_DIR, 'accounts');
const STUDENTS_DIR = path.join(DB_DIR, 'students');
const TICKETS_DIR = path.join(DB_DIR, 'tickets');

// Helper: Read university data
const readUniversity = async (email) => {
    try {
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
        const filePath = path.join(UNIVERSITIES_DIR, `${sanitizedEmail}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
};

// Helper: Get all accounts for a university
const getUniversityAccounts = async (universityEmail) => {
    try {
        const files = await fs.readdir(ACCOUNTS_DIR);
        const accounts = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(ACCOUNTS_DIR, file);
                const data = await fs.readFile(filePath, 'utf8');
                const account = JSON.parse(data);
                if (account.universityEmail === universityEmail) {
                    const { password, ...accountData } = account;
                    accounts.push(accountData);
                }
            }
        }

        return accounts;
    } catch (error) {
        console.error('Error getting university accounts:', error);
        return [];
    }
};

// Helper: Read account data
const readAccount = async (email) => {
    try {
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
        const filePath = path.join(ACCOUNTS_DIR, `${sanitizedEmail}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
};

// Helper: Write account data
const writeAccount = async (email, accountData) => {
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
    const filePath = path.join(ACCOUNTS_DIR, `${sanitizedEmail}.json`);
    await fs.writeFile(filePath, JSON.stringify(accountData, null, 2));
};

// ============================================
// SYSTEM ADMIN APIs (GET VERSION)
// ============================================

// API 1: Get all universities (system admin purpose) - GET
router.get('/universities/all', async (req, res) => {
    try {
        const files = await fs.readdir(UNIVERSITIES_DIR);
        const universities = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(UNIVERSITIES_DIR, file);
                const data = await fs.readFile(filePath, 'utf8');
                const university = JSON.parse(data);
                const { password, ...universityData } = university;
                universities.push(universityData);
            }
        }

        res.json({
            count: universities.length,
            universities
        });
    } catch (error) {
        console.error('Get all universities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 2: Get university details by email - GET
router.get('/universities/detail/:email', async (req, res) => {
    try {
        const { email } = req.params;

        const university = await readUniversity(email);
        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        // Get all accounts for this university
        const accounts = await getUniversityAccounts(email);

        // Get all students for this university
        const studentFiles = await fs.readdir(STUDENTS_DIR);
        const students = [];

        for (const file of studentFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(STUDENTS_DIR, file);
                const data = await fs.readFile(filePath, 'utf8');
                const student = JSON.parse(data);
                if (student.universityEmail === email) {
                    const { password, ...studentData } = student;
                    students.push(studentData);
                }
            }
        }

        // Return university data without password
        const { password, ...universityData } = university;

        res.json({
            university: universityData,
            statistics: {
                accounts: accounts.length,
                students: students.length,
                totalUsers: accounts.length + students.length
            },
            accounts: {
                count: accounts.length,
                list: accounts
            },
            students: {
                count: students.length,
                list: students.slice(0, 50) // Return first 50 students to avoid large response
            }
        });
    } catch (error) {
        console.error('Get university details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 3: Get API key statistics (system admin only) - GET
router.get('/api-keys/stats', async (req, res) => {
    try {
        const stats = await apiKeyManager.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Get API key stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 4: Get all API keys with details (system admin only) - GET
router.get('/api-keys', async (req, res) => {
    try {
        const result = await apiKeyManager.getAllKeys();
        res.json(result);
    } catch (error) {
        console.error('Get all API keys error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 5: Add new API key (system admin only) - GET
router.get('/api-keys/add', async (req, res) => {
    try {
        const { apiKey } = req.query;

        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        const result = await apiKeyManager.addKey(apiKey);

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Add API key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 6: Release API key from a university (system admin only) - GET
router.get('/api-keys/release', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'University email is required' });
        }

        const result = await apiKeyManager.releaseKey(email);
        res.json(result);
    } catch (error) {
        console.error('Release API key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 7: Delete API key from pool (system admin only) - GET
router.get('/api-keys/delete/:keyId', async (req, res) => {
    try {
        const { keyId } = req.params;

        if (!keyId) {
            return res.status(400).json({ error: 'API key ID is required' });
        }

        const result = await apiKeyManager.deleteKey(keyId);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Delete API key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 8: Reassign API key to different university (system admin only) - GET
router.get('/api-keys/reassign', async (req, res) => {
    try {
        const { fromEmail, toEmail } = req.query;

        if (!fromEmail || !toEmail) {
            return res.status(400).json({
                error: 'Both fromEmail and toEmail are required'
            });
        }

        if (fromEmail === toEmail) {
            return res.status(400).json({
                error: 'Cannot reassign to the same university'
            });
        }

        // Check if target university exists
        const targetUniversity = await readUniversity(toEmail);
        if (!targetUniversity) {
            return res.status(404).json({
                error: 'Target university not found'
            });
        }

        // Check if target university already has an API key
        const targetKeyInfo = await apiKeyManager.getKeyForUniversity(toEmail);
        if (targetKeyInfo.success) {
            return res.status(400).json({
                error: 'Target university already has an API key assigned'
            });
        }

        // Release key from source university
        const releaseResult = await apiKeyManager.releaseKey(fromEmail);
        if (!releaseResult.success) {
            return res.status(400).json(releaseResult);
        }

        // Assign the same key to target university
        const assignResult = await apiKeyManager.assignKey(toEmail, targetUniversity.universityId);

        if (assignResult.success) {
            res.json({
                message: 'API key reassigned successfully',
                fromUniversity: fromEmail,
                toUniversity: toEmail,
                keyId: assignResult.keyId
            });
        } else {
            // If assignment fails, try to reassign back to original
            await apiKeyManager.assignKey(fromEmail, 'recovery_' + Date.now());
            res.status(500).json({
                error: 'Failed to reassign API key',
                details: assignResult.error
            });
        }
    } catch (error) {
        console.error('Reassign API key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 9: Get system health and statistics - GET
router.get('/system/health', async (req, res) => {
    try {
        // Get API key statistics
        const apiKeyStats = await apiKeyManager.getStats();

        // Count universities
        const universityFiles = await fs.readdir(UNIVERSITIES_DIR);
        const universityCount = universityFiles.filter(file => file.endsWith('.json')).length;

        // Count accounts
        const accountFiles = await fs.readdir(ACCOUNTS_DIR);
        const accountCount = accountFiles.filter(file => file.endsWith('.json')).length;

        // Count students
        const studentFiles = await fs.readdir(STUDENTS_DIR);
        const studentCount = studentFiles.filter(file => file.endsWith('.json')).length;

        // Count tickets
        const ticketFiles = await fs.readdir(TICKETS_DIR);
        const ticketCount = ticketFiles.filter(file => file.endsWith('.json')).length;

        // Calculate disk usage
        let totalSize = 0;

        // Helper function to calculate directory size
        const calculateDirSize = async (dirPath) => {
            let size = 0;
            const files = await fs.readdir(dirPath);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(dirPath, file);
                    const stats = await fs.stat(filePath);
                    size += stats.size;
                }
            }
            return size;
        };

        // Calculate sizes for all directories
        const uniSize = await calculateDirSize(UNIVERSITIES_DIR);
        const accSize = await calculateDirSize(ACCOUNTS_DIR);
        const stuSize = await calculateDirSize(STUDENTS_DIR);
        const tickSize = await calculateDirSize(TICKETS_DIR);

        totalSize = uniSize + accSize + stuSize + tickSize;

        // Convert to MB
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const uniSizeMB = (uniSize / (1024 * 1024)).toFixed(2);
        const accSizeMB = (accSize / (1024 * 1024)).toFixed(2);
        const stuSizeMB = (stuSize / (1024 * 1024)).toFixed(2);
        const tickSizeMB = (tickSize / (1024 * 1024)).toFixed(2);

        res.json({
            system: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                nodeVersion: process.version
            },
            statistics: {
                universities: universityCount,
                accounts: accountCount,
                students: studentCount,
                tickets: ticketCount,
                totalUsers: universityCount + accountCount + studentCount,
                storageUsed: `${totalSizeMB} MB`,
                storageBreakdown: {
                    universities: `${uniSizeMB} MB`,
                    accounts: `${accSizeMB} MB`,
                    students: `${stuSizeMB} MB`,
                    tickets: `${tickSizeMB} MB`
                }
            },
            apiKeys: apiKeyStats
        });
    } catch (error) {
        console.error('System health check error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// API 10: Force deactivate/reactivate university (system admin only) - GET
router.get('/universities/status', async (req, res) => {
    try {
        const { email, isActive } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'University email is required' });
        }

        if (!isActive || (isActive !== 'true' && isActive !== 'false')) {
            return res.status(400).json({
                error: 'isActive must be either "true" or "false"'
            });
        }

        const isActiveBool = isActive === 'true';

        const university = await readUniversity(email);
        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        // Update status
        university.isActive = isActiveBool;
        university.updatedAt = new Date().toISOString();

        // Save updated data
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
        const filePath = path.join(UNIVERSITIES_DIR, `${sanitizedEmail}.json`);
        await fs.writeFile(filePath, JSON.stringify(university, null, 2));

        // Also deactivate/reactivate all accounts of this university
        const accounts = await getUniversityAccounts(email);
        for (const account of accounts) {
            const accountData = await readAccount(account.accountEmail);
            if (accountData) {
                accountData.isActive = isActiveBool;
                accountData.updatedAt = new Date().toISOString();
                await writeAccount(account.accountEmail, accountData);
            }
        }

        res.json({
            message: `University ${isActiveBool ? 'activated' : 'deactivated'} successfully`,
            email: email,
            isActive: isActiveBool,
            affectedAccounts: accounts.length
        });
    } catch (error) {
        console.error('Update university status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 11: Delete university (system admin only) - GET
router.get('/universities/delete', async (req, res) => {
    try {
        const { email, confirm } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'University email is required' });
        }

        if (confirm !== 'true') {
            return res.status(400).json({
                error: 'Please confirm deletion by adding confirm=true',
                warning: 'This will delete the university, all its accounts, and all related data!'
            });
        }

        const university = await readUniversity(email);
        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        console.log(`\n========= ADMIN DELETING UNIVERSITY: ${university.universityName} =========`);

        // 1. Release API key
        console.log(`Releasing API key for university: ${email}`);
        await apiKeyManager.releaseKey(email);

        // 2. Delete all accounts for this university
        const accounts = await getUniversityAccounts(email);
        console.log(`Found ${accounts.length} accounts to delete.`);

        for (const acc of accounts) {
            // Delete account file
            const sanitizedAccEmail = acc.accountEmail.replace(/[^a-zA-Z0-9@._-]/g, '_');
            const accountPath = path.join(ACCOUNTS_DIR, `${sanitizedAccEmail}.json`);
            await fs.unlink(accountPath);
            console.log(`Deleted account: ${acc.accountEmail}`);
        }

        // 3. Delete all students of this university
        const studentFiles = await fs.readdir(STUDENTS_DIR);
        let studentCount = 0;

        for (const file of studentFiles) {
            const filePath = path.join(STUDENTS_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            const student = JSON.parse(data);

            if (student.universityEmail === email) {
                await fs.unlink(filePath);
                studentCount++;
                console.log(`Deleted student: ${student.email}`);
            }
        }

        // 4. Delete all tickets related to this university
        const ticketFiles = await fs.readdir(TICKETS_DIR);
        let ticketCount = 0;

        for (const file of ticketFiles) {
            const filePath = path.join(TICKETS_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            const ticket = JSON.parse(data);

            if (ticket.universityEmail === email) {
                await fs.unlink(filePath);
                ticketCount++;
                console.log(`Deleted ticket: ${ticket.ticketId}`);
            }
        }

        // 5. Delete university file
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
        const uniPath = path.join(UNIVERSITIES_DIR, `${sanitizedEmail}.json`);
        await fs.unlink(uniPath);

        console.log(`========= UNIVERSITY DELETE COMPLETE =========\n`);

        res.json({
            message: 'University and all associated data deleted successfully',
            university: {
                email: email,
                name: university.universityName
            },
            deleted: {
                accounts: accounts.length,
                students: studentCount,
                tickets: ticketCount,
                total: accounts.length + studentCount + ticketCount + 1 // +1 for university itself
            }
        });

    } catch (error) {
        console.error('Delete university error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 12: Get system logs or recent activity - GET
router.get('/system/activity', async (req, res) => {
    try {
        const { limit } = req.query;
        const activityLimit = limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 100;

        // Collect recent activity from different sources
        const activities = [];

        // 1. Recent university registrations
        const uniFiles = await fs.readdir(UNIVERSITIES_DIR);
        for (const file of uniFiles.slice(-10)) { // Last 10 universities
            if (file.endsWith('.json')) {
                const filePath = path.join(UNIVERSITIES_DIR, file);
                const data = await fs.readFile(filePath, 'utf8');
                const uni = JSON.parse(data);
                activities.push({
                    type: 'university_registration',
                    email: uni.email,
                    name: uni.universityName,
                    timestamp: uni.createdAt,
                    description: `University registered: ${uni.universityName}`
                });
            }
        }

        // 2. Recent account creations
        const accFiles = await fs.readdir(ACCOUNTS_DIR);
        for (const file of accFiles.slice(-20)) { // Last 20 accounts
            if (file.endsWith('.json')) {
                const filePath = path.join(ACCOUNTS_DIR, file);
                const data = await fs.readFile(filePath, 'utf8');
                const acc = JSON.parse(data);
                activities.push({
                    type: 'account_creation',
                    email: acc.accountEmail,
                    name: acc.accountName,
                    timestamp: acc.createdAt,
                    description: `Account created: ${acc.accountName} (${acc.universityName})`
                });
            }
        }

        // 3. Recent student registrations
        const stuFiles = await fs.readdir(STUDENTS_DIR);
        for (const file of stuFiles.slice(-30)) { // Last 30 students
            if (file.endsWith('.json')) {
                const filePath = path.join(STUDENTS_DIR, file);
                const data = await fs.readFile(filePath, 'utf8');
                const stu = JSON.parse(data);
                activities.push({
                    type: 'student_registration',
                    email: stu.email,
                    name: stu.name,
                    timestamp: stu.createdAt,
                    description: `Student registered: ${stu.name} (${stu.universityName})`
                });
            }
        }

        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply limit
        const recentActivities = activities.slice(0, activityLimit);

        res.json({
            totalActivities: activities.length,
            recentActivities: recentActivities,
            summary: {
                universities: uniFiles.filter(f => f.endsWith('.json')).length,
                accounts: accFiles.filter(f => f.endsWith('.json')).length,
                students: stuFiles.filter(f => f.endsWith('.json')).length
            }
        });
    } catch (error) {
        console.error('Get system activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API 13: Clear system cache or temporary data - GET
router.get('/system/cleanup', async (req, res) => {
    try {
        const { type, confirm } = req.query;

        if (confirm !== 'true') {
            return res.status(400).json({
                error: 'Please confirm cleanup by adding confirm=true',
                warning: 'This action may delete temporary or cached data!'
            });
        }

        let message = '';
        let deletedCount = 0;

        if (!type || type === 'all') {
            // Count empty or corrupted files
            const directories = [UNIVERSITIES_DIR, ACCOUNTS_DIR, STUDENTS_DIR, TICKETS_DIR];

            for (const dir of directories) {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(dir, file);
                        try {
                            const data = await fs.readFile(filePath, 'utf8');
                            JSON.parse(data); // Validate JSON
                        } catch {
                            // Delete corrupted file
                            await fs.unlink(filePath);
                            deletedCount++;
                        }
                    }
                }
            }
            message = `Cleaned up ${deletedCount} corrupted files`;
        }

        res.json({
            message: message || 'Cleanup completed',
            deletedCount: deletedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('System cleanup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;