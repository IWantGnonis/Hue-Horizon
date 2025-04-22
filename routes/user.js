// In a new file like routes/user.js
import express from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
    try {
        console.log('Getting profile for user:', req.user.id);
        
        // Get user data
        const { data: userData, error: userError } = await req.supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();
            
        if (userError) throw userError;
        
        console.log('User data retrieved:', {
            id: userData.id,
            full_name: userData.full_name,
            avatar_url: userData.avatar_url,
            created_at: userData.created_at
        });
        
        // Get user stats
        const { data: artworksData, error: artworksError } = await req.supabase
            .from('artworks')
            .select('id')
            .eq('user_id', req.user.id);
            
        if (artworksError) throw artworksError;
        
        // Get total views
        const { data: viewsData, error: viewsError } = await req.supabase
            .from('artworks')
            .select('views')
            .eq('user_id', req.user.id);
            
        const totalViews = viewsData ? viewsData.reduce((sum, artwork) => sum + (artwork.views || 0), 0) : 0;
        
        // Get total favorites
        const { data: favoritesData, error: favoritesError } = await req.supabase
            .from('favorites')
            .select('artwork_id')
            .in('artwork_id', artworksData.map(a => a.id) || []);
            
       // Calculate views over time
const { data: viewsOverTimeData, error: viewsOverTimeError } = await req.supabase
  .from('artworks')
  .select('created_at, views')
  .eq('user_id', req.user.id)
  .order('created_at');

if (viewsOverTimeError) throw viewsOverTimeError;

const viewsOverTime = viewsOverTimeData.map(item => ({
  date: item.created_at.substring(0, 10), // Extract YYYY-MM-DD
  count: item.views || 0,
}));

// Calculate favorites over time
const { data: favoritesOverTimeData, error: favoritesOverTimeError } = await req.supabase
  .from('favorites')
  .select('created_at, artwork_id')
  .in('artwork_id', artworksData.map(a => a.id) || [])
  .order('created_at');

if (favoritesOverTimeError) throw favoritesOverTimeError;

const favoritesOverTime = favoritesOverTimeData.map(item => ({
    date: item.created_at.substring(0, 10),
    count: 1
}));

        // Calculate category distribution
const { data: categoryDistributionData, error: categoryDistributionError } = await req.supabase
    .from('artworks')
    .select('category_id, categories!inner(name)')
    .eq('user_id', req.user.id);
    
if (categoryDistributionError) throw categoryDistributionError;

const categoryDistribution = categoryDistributionData.reduce((acc, item) => {
  const categoryName = item.categories.name;
  const existing = acc.find(c => c.category === categoryName);
  if (existing) {
    existing.count++;
  } else {
    acc.push({ category: categoryName, count: 1 });
  }
  return acc;
}, []);

        const stats = {
            totalArtworks: artworksData ? artworksData.length : 0,
            totalViews,
            totalFavorites: favoritesData ? favoritesData.length : 0,
            viewsOverTime,
            favoritesOverTime,
            categoryDistribution
        };
        
        console.log('User stats:', stats);

        res.json({
            success: true,
            user: userData,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user profile by user ID
router.get('/profile/:userId', authenticateUser, async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Getting profile for user:', userId);
        
        // Get user data
        const { data: userData, error: userError } = await req.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (userError) throw userError;
        
        console.log('User data retrieved:', {
            id: userData.id,
            full_name: userData.full_name,
            avatar_url: userData.avatar_url,
            created_at: userData.created_at
        });
        
        res.json({
            success: true,
            user: userData
        });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user profile
router.post('/profile', authenticateUser, upload.single('avatar'), async (req, res) => {
    try {
        console.log('Profile update request received');
        console.log('Request body:', req.body);
        console.log('File:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            buffer: req.file.buffer ? 'Buffer present' : 'No buffer'
        } : 'No file uploaded');
        
        const { fullName, bio, location } = req.body;
        
        // Prepare update data
        const updateData = {
            full_name: fullName || req.user.full_name,
            bio: bio || null,
            location: location || null,
            updated_at: new Date()
        };

        // Handle avatar upload if provided
        let avatarUrl = null;
        if (req.file) {
            console.log('Processing avatar upload');
            
            // Create a unique filename
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `${req.user.id}/avatar-${Date.now()}.${fileExt}`;
            
            console.log('Uploading to storage with filename:', fileName);
            
            // Upload to storage
            const { data: uploadData, error: uploadError } = await req.supabase
                .storage
                .from('avatars')
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                console.error('Avatar upload error:', uploadError);
                throw uploadError;
            }

            console.log('Upload successful:', uploadData);

            // Get public URL
            const { data: { publicUrl } } = req.supabase
                .storage
                .from('avatars')
                .getPublicUrl(fileName);

            console.log('Avatar public URL:', publicUrl);
            updateData.avatar_url = publicUrl;
            avatarUrl = publicUrl;
        }

        console.log('Updating user with data:', updateData);

        // Update user in database
        const { data: updatedUser, error: updateError } = await req.supabase
            .from('users')
            .update(updateData)
            .eq('id', req.user.id)
            .select()
            .single();

        if (updateError) {
            console.error('Database update error:', updateError);
            throw updateError;
        }

        console.log('Profile updated successfully. Updated user:', updatedUser);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            fullName: updatedUser.full_name,
            avatarUrl: avatarUrl || updatedUser.avatar_url
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Change password
router.post('/change-password', authenticateUser, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // Validate passwords
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'New passwords do not match'
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long'
            });
        }

        // Verify current password
        const { error: signInError } = await req.supabase.auth.signInWithPassword({
            email: req.user.email,
            password: currentPassword
        });

        if (signInError) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Update password
        const { error: updateError } = await req.supabase.auth.updateUser({
            password: newPassword
        });

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
