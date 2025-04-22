import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';

export const authenticateUser = async (req, res, next) => {
    const token = req.cookies.access_token;

    if (!token) {
        console.log("No access token found in cookies");
        res.redirect('/');
        return;
    }

    try {
        // Create a new Supabase client with the user's token
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        );

        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Auth error:', error);
            
            // Clear the invalid token
            res.clearCookie('access_token');
            
            return res.status(401).json({ 
                success: false, 
                error: 'Session expired',
                redirect: '/'
            });
        }

        if (!user) {
            console.log("No user found with token");
            res.clearCookie('access_token');
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid session',
                redirect: '/'
            });
        }

        console.log("Successfully authenticated user:", user.email);
        
        // Get user status from database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('status')
            .eq('id', user.id)
            .single();

        if (userError) {
            console.error('Error fetching user status:', userError);
            throw userError;
        }

        // Set user session with status information
        req.user = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            status: userData.status || 'user'
        };
        
        console.log('Authenticated user:', req.user);
        req.supabase = supabase;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.clearCookie('access_token');
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication failed',
            redirect: '/'
        });
    }
};
