import { auth } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  // Social login buttons
  const socialButtons = document.querySelectorAll('.social-button');
  socialButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const provider = e.currentTarget.querySelector('span').textContent.toLowerCase();
      
      try {
        const { data, error } = await auth.signInWithProvider(provider);
        if (error) throw error;
        
        // Redirect to dashboard on successful login
        if (data) window.location.href = '/home';
      } catch (error) {
        console.error('Error:', error.message);
        alert('Failed to login with ' + provider);
      }
    });
  });

  // Back button handling
  const backButton = document.querySelector('.back-button');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.history.back();
    });
  }

  // Form validation
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password) {
    return password.length >= 6;
  }

  // Signup form handling
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    const signupButton = signupForm.querySelector('button');
    signupButton.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = signupForm.querySelector('input[type="email"]').value;
      const password = signupForm.querySelectorAll('input[type="password"]')[0].value;
      const confirmPassword = signupForm.querySelectorAll('input[type="password"]')[1].value;

      if (!validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
      }

      if (!validatePassword(password)) {
        alert('Password must be at least 6 characters long');
        return;
      }

      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      try {
        const { data, error } = await auth.signUp(email, password);
        if (error) throw error;
        
        if (data) {
          alert('Registration successful! Please check your email to verify your account.');
          window.location.href = '/home';
        }
      } catch (error) {
        console.error('Error:', error.message);
        alert('Failed to sign up: ' + error.message);
      }
    });
  }

  // Login form handling
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const loginButton = loginForm.querySelector('button');
    loginButton.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = loginForm.querySelector('input[type="email"]').value;
      const password = loginForm.querySelector('input[type="password"]').value;

      if (!validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
      }

      if (!password) {
        alert('Please enter your password');
        return;
      }

      try {
        const { data, error } = await auth.signIn(email, password);
        if (error) throw error;
        
        if (data) window.location.href = '/home';
      } catch (error) {
        console.error('Error:', error.message);
        alert('Failed to login: ' + error.message);
      }
    });
  }

  // Main sign in form handling
  const mainLoginButton = document.getElementById('mainLoginButton');
  const mainSignupButton = document.getElementById('mainSignupButton');
  const socialAuth = document.querySelector('.social-auth');

  if (mainLoginButton) {
    mainLoginButton.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('mainEmail').value;
      const password = document.getElementById('mainPassword').value;
      
      if (!validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
      }

      if (!password) {
        alert('Please enter your password');
        return;
      }

      try {
        const { data, error } = await auth.signIn(email, password);
        if (error) throw error;
        
        // Redirect to dashboard on successful login
        if (data) window.location.href = '/home';
      } catch (error) {
        console.error('Error:', error.message);
        alert('Failed to login: ' + error.message);
      }
    });
  }

  // Main signup button handling
  if (mainSignupButton) {
    mainSignupButton.addEventListener('click', () => {
      socialAuth.classList.add('hidden');
      signupForm.classList.add('active');
    });
  }

  // Create particles for background animation
  createParticles();
  
  // Logo hover effect with Tailwind classes
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('mouseover', () => {
      logo.classList.add('rotate-[360deg]', 'scale-110');
    });
    
    logo.addEventListener('mouseout', () => {
      logo.classList.remove('rotate-[360deg]', 'scale-110');
    });
  }
  
  // Random image from Unsplash on refresh
  randomizeBackgroundImage();

  // Check if user is already logged in
  checkAuthState();
});

// Function to check authentication state
async function checkAuthState() {
  try {
    const { session, error } = await auth.getSession();
    if (error) throw error;
    
    // If user is already logged in, redirect to dashboard
    if (session) {
      window.location.href = '/home';
    }
  } catch (error) {
    console.error('Auth state error:', error.message);
  }
}

// Function to create particles
function createParticles() {
  const particlesContainer = document.getElementById('particles');
  const particleCount = 80; // Increased particle count
  
  if (!particlesContainer) return;
  
  // Clear existing particles
  particlesContainer.innerHTML = '';
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('span');
    particle.classList.add('particle');
    
    // Random position
    const posX = Math.random() * window.innerWidth;
    const posY = Math.random() * window.innerHeight;
    
    // More varied sizes
    const size = Math.random() * 8 + 2;
    
    // Expanded color palette with artistic colors
    const colors = [
      'rgba(138, 43, 226, 0.7)', // purple
      'rgba(65, 105, 225, 0.7)', // royal blue
      'rgba(0, 191, 255, 0.7)',  // deep sky blue
      'rgba(255, 105, 180, 0.7)', // hot pink
      'rgba(255, 165, 0, 0.7)',   // orange
      'rgba(50, 205, 50, 0.7)',   // lime green
      'rgba(255, 215, 0, 0.7)',   // gold
      'rgba(219, 112, 147, 0.7)'  // pale violet red
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // More varied animation duration
    const duration = Math.random() * 25 + 10;
    
    // Random animation delay
    const delay = Math.random() * 8;
    
    // Apply styles
    particle.style.left = `${posX}px`;
    particle.style.top = `${posY}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.animationDuration = `${duration}s`;
    particle.style.animationDelay = `${delay}s`;
    
    // Add random blur effect to some particles
    if (Math.random() > 0.7) {
      particle.style.filter = `blur(${Math.random() * 2}px)`;
    }
    
    // Add random opacity
    particle.style.opacity = (Math.random() * 0.5 + 0.3).toString();
    
    particlesContainer.appendChild(particle);
  }
  
  // Add window resize handler to recreate particles
  window.addEventListener('resize', debounce(() => {
    createParticles();
  }, 200));
}

// Debounce function to limit how often a function can be called
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Function to randomize background image
function randomizeBackgroundImage() {
  // Use the specific class we added to the image
  const imageContainer = document.querySelector('.background-image');
  
  if (imageContainer) {
    // Collection of reliable artistic image URLs from Unsplash - focused on actual artwork, no gradients
    const artisticImages = [
      'https://images.unsplash.com/photo-1536924940846-227afb31e2a5', // Colorful abstract painting
      'https://images.unsplash.com/photo-1549490349-8643362247b5', // Colorful paint
      'https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb', // Colorful splatter
      'https://images.unsplash.com/photo-1574169208507-84376144848b', // Digital art
      'https://images.unsplash.com/photo-1482160549825-59d1b23cb208', // Colorful painting
      'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d', // Art gallery
      'https://images.unsplash.com/photo-1515405295579-ba7b45403062', // Abstract painting
      'https://images.unsplash.com/photo-1547891654-e66ed7ebb968', // Colorful art
      'https://images.unsplash.com/photo-1558865869-c93d6f8c8152', // Artistic wall
      'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9', // Abstract painting
      'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7', // Colorful art
      'https://images.unsplash.com/photo-1552084117-56a987666449', // Artistic photography
      'https://images.unsplash.com/photo-1563089145-599997674d42', // Abstract art
      'https://images.unsplash.com/photo-1549277513-f1b32fe1f8f5', // Colorful painting
      'https://images.unsplash.com/photo-1576769267415-9242c9cd2940', // Artistic paint
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5', // Colorful artwork
      'https://images.unsplash.com/photo-1533158326339-7f3cf2404354', // Art installation
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b', // Painting closeup
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f', // Art supplies
      'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8'  // Art in process
    ];
    
    // Select a random image from the collection
    const randomIndex = Math.floor(Math.random() * artisticImages.length);
    const imageUrl = `${artisticImages[randomIndex]}?ixlib=rb-4.0.3&auto=format&fit=crop&w=1500&h=1500`;
    
    // Add loading state
    imageContainer.classList.add('opacity-50');
    
    console.log(`Loading specific artistic image: ${randomIndex + 1}/${artisticImages.length}`);
    
    // Load the image
    const newImage = new Image();
    newImage.src = imageUrl;
    
    // When image loads, apply it to the container
    newImage.onload = () => {
      imageContainer.src = newImage.src;
      imageContainer.classList.remove('opacity-50');
      imageContainer.classList.add('opacity-100');
      console.log('Image loaded successfully');
    };
    
    // Fallback in case the specific image doesn't load
    newImage.onerror = () => {
      console.log('Specific image failed to load, trying another one');
      // Try another image from the collection
      tryAnotherImage(imageContainer, artisticImages, randomIndex);
    };
    
    // Set a timeout in case the image takes too long to load
    setTimeout(() => {
      if (imageContainer.classList.contains('opacity-50')) {
        console.log('Image load timeout, trying another one');
        tryAnotherImage(imageContainer, artisticImages, randomIndex);
      }
    }, 3000);
  }
}

// Function to try another image from the collection
function tryAnotherImage(imageContainer, imageCollection, previousIndex, attempt = 1) {
  // If we've tried too many times, use a guaranteed working image
  if (attempt > 3) {
    const guaranteedImage = 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1500&h=1500';
    console.log('Using guaranteed fallback image');
    imageContainer.src = guaranteedImage;
    imageContainer.classList.remove('opacity-50');
    return;
  }
  
  // Get a different index than the previous one
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * imageCollection.length);
  } while (newIndex === previousIndex);
  
  const imageUrl = `${imageCollection[newIndex]}?ixlib=rb-4.0.3&auto=format&fit=crop&w=1500&h=1500`;
  
  console.log(`Trying another image: ${newIndex + 1}/${imageCollection.length} (attempt ${attempt})`);
  
  // Load the new image
  const newImage = new Image();
  newImage.src = imageUrl;
  
  // When image loads, apply it to the container
  newImage.onload = () => {
    imageContainer.src = newImage.src;
    imageContainer.classList.remove('opacity-50');
    imageContainer.classList.add('opacity-100');
    console.log('Image loaded successfully');
  };
  
  // Fallback in case this image also doesn't load
  newImage.onerror = () => {
    console.log(`Attempt ${attempt} failed, trying another image`);
    // Try yet another image
    tryAnotherImage(imageContainer, imageCollection, newIndex, attempt + 1);
  };
  
  // Set a timeout in case the image takes too long to load
  setTimeout(() => {
    if (imageContainer.classList.contains('opacity-50')) {
      console.log(`Attempt ${attempt} timed out, trying another image`);
      tryAnotherImage(imageContainer, imageCollection, newIndex, attempt + 1);
    }
  }, 3000);
} 