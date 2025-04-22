import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Get user status from database
        const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('is_banned')
            .eq('id', data.user.id)
            .single();

        if (userError) throw userError;

        if (userData?.is_banned) {
            return res.status(403).json({
                success: false,
                error: 'You have been banned from accessing the application.'
            });
        }

        // Set the access token cookie
        res.cookie('access_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: data.session.expires_in * 1000,
            path: '/'
        }).json({ 
            success: true,
            user: {
                ...data.user,
                status: userData?.status || 'user'
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/check', authenticateUser, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                isAdmin: req.user.isAdmin
            }
        });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }
});

// New endpoint to fetch all users
router.get('/admin/users', authenticateUser, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { data: users, error } = await req.supabase
            .from('users')
            .select('*');

        if (error) throw error;
        res.json({ success: true, users });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }
});

router.post('/logout', authenticateUser, async (req, res) => {
    try {
        // Clear the access token cookie
        res.clearCookie('access_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        // If using Supabase auth, you could also call:
        // const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        // await supabase.auth.signOut();

        // Return redirect instruction
        res.json({
            success: true,
            redirect: '/'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
});

export default router;
