  // Wait for DOM to load
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize Supabase with error handling
            let supabase;
            
            try {
                // ✅ USE YOUR EXACT SUPABASE CREDENTIALS
                const supabaseUrl = "https://tfuwozhljthmxxcztfws.supabase.co";
                const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdXdvemhsanRobXh4Y3p0ZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5OTA0NjEsImV4cCI6MjA4MTU2NjQ2MX0.7stJZibmLvBk0-oEQk6XSfjsfXaqYf9_O3308ZBOTjc";
                
                // Check if Supabase is loaded
                if (typeof window.supabase === 'undefined') {
                    console.error('Supabase library not loaded');
                    alert('Error: Authentication service not available. Please refresh the page.');
                    return;
                }
                
                supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
                console.log("Supabase initialized successfully");
                
            } catch (error) {
                console.error("Failed to initialize Supabase:", error);
                alert('Authentication service temporarily unavailable. Please try again later.');
                return;
            }

            // Tab switching functionality
            document.querySelectorAll('.tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    // Remove active class from all tabs and forms
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
                    
                    // Add active class to clicked tab
                    tab.classList.add('active');
                    
                    // Show corresponding form
                    const tabId = tab.getAttribute('data-tab');
                    document.getElementById(`${tabId}-form`).classList.add('active');
                });
            });

            // Forgot Password Modal
            document.getElementById('forgot-password-link').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('forgot-password-modal').classList.add('active');
            });

            // Close modal
            document.getElementById('close-forgot-modal').addEventListener('click', function() {
                document.getElementById('forgot-password-modal').classList.remove('active');
            });

            // Button loading state utility
            function setButtonLoading(button, isLoading) {
                if (isLoading) {
                    button.classList.add('loading');
                    button.disabled = true;
                } else {
                    button.classList.remove('loading');
                    button.disabled = false;
                }
            }

            // Send password reset email
            document.getElementById('send-reset-link-btn').addEventListener('click', async function() {
                const email = document.getElementById('reset-email').value;
                
                if (!email) {
                    alert('Please enter your email address');
                    return;
                }
                
                if (!supabase) {
                    alert('Authentication service not available');
                    return;
                }
                
                const btn = this;
                setButtonLoading(btn, true);
                
                try {
                    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + '/reset-password.html'
                    });
                    
                    if (error) throw error;
                    
                    alert('Check your email for password reset instructions.');
                    document.getElementById('forgot-password-modal').classList.remove('active');
                    document.getElementById('reset-email').value = '';
                    
                } catch (error) {
                    alert('Failed to send reset email: ' + error.message);
                } finally {
                    setButtonLoading(btn, false);
                }
            });

            // ✅ Signup Form with Supabase Auth
            document.getElementById('signup-form').addEventListener('submit', async function(e) {
                e.preventDefault();

                if (!supabase) {
                    alert('Authentication service not available');
                    return;
                }

                const username = document.getElementById('signup-username').value;
                const email = document.getElementById('signup-email').value;
                const phone = document.getElementById('signup-phone').value;
                const password = document.getElementById('signup-password').value;
                const confirmPassword = document.getElementById('signup-confirm').value;

                // Validation
                if (!username.trim() || !email.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
                    alert('Please fill in all fields');
                    return;
                }

                if (password !== confirmPassword) {
                    alert('Passwords do not match!');
                    return;
                }

                if (password.length < 6) {
                    alert('Password must be at least 6 characters long');
                    return;
                }

                const submitBtn = document.getElementById('signup-btn');
                setButtonLoading(submitBtn, true);

                try {
                    console.log("Starting Supabase signup for:", email);
                    
                    // ✅ Supabase signup - creates user in Auth system
                    const { data, error } = await supabase.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: { 
                                username: username, 
                                phone: phone 
                            }
                        }
                    });

                    if (error) {
                        console.error("Signup error:", error);
                        alert('Signup failed: ' + error.message);
                        setButtonLoading(submitBtn, false);
                        return;
                    }

                    console.log("Supabase signup successful:", data);
                    
                    // ✅ The trigger in Supabase will automatically create the user in the users table
                    alert(`Welcome ${username}! Your account has been created successfully.`);
                    
                    // Store user info in localStorage for immediate access
                    localStorage.setItem('alCaponeClubUser', JSON.stringify({
                        username: username,
                        email: email,
                        phone: phone
                    }));
                    
                    // Redirect to inside club
                    setTimeout(() => {
                        window.location.href = 'insideclub.html';
                    }, 1000);

                } catch (error) {
                    console.error("Unexpected error:", error);
                    alert('Error: ' + error.message);
                    setButtonLoading(submitBtn, false);
                }
            });

            // ✅ Signin Form with Supabase Auth
            document.getElementById('signin-form').addEventListener('submit', async function(e) {
                e.preventDefault();

                if (!supabase) {
                    alert('Authentication service not available');
                    return;
                }

                const email = document.getElementById('signin-email').value;
                const password = document.getElementById('signin-password').value;

                if (!email.trim() || !password.trim()) {
                    alert('Please fill in all fields');
                    return;
                }

                const submitBtn = document.getElementById('signin-btn');
                setButtonLoading(submitBtn, true);

                try {
                    console.log("Starting Supabase login for:", email);
                    
                    // ✅ Supabase sign in
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: email,
                        password: password
                    });

                    if (error) {
                        console.error("Login error:", error);
                        alert('Login failed: ' + error.message);
                        setButtonLoading(submitBtn, false);
                        return;
                    }

                    console.log("Supabase login successful:", data);
                    
                    // Get user info from metadata
                    const username = data.user.user_metadata?.username || email.split('@')[0];
                    const phone = data.user.user_metadata?.phone || '';
                    
                    // Store user info in localStorage
                    localStorage.setItem('alCaponeClubUser', JSON.stringify({
                        username: username,
                        email: email,
                        phone: phone,
                        userId: data.user.id
                    }));
                    
                    alert('Login successful! Welcome back.');
                    
                    // Redirect to inside club
                    setTimeout(() => {
                        window.location.href = 'insideclub.html';
                    }, 1000);

                } catch (error) {
                    console.error("Unexpected error:", error);
                    alert('Error: ' + error.message);
                    setButtonLoading(submitBtn, false);
                }
            });

            // Load your logo from the specified path
            const mainLogo = document.getElementById('main-logo');
            const mainLogoPlaceholder = document.getElementById('main-logo-placeholder');
            
            // Try to load your logo from the specified path
            mainLogo.src = 'images/logo.png';
            mainLogo.onload = function() {
                mainLogo.style.display = 'block';
                mainLogoPlaceholder.style.display = 'none';
            };
            mainLogo.onerror = function() {
                console.log('Logo not found at images/logo.png');
            };

            // Demo mode for testing
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('demo') === 'true') {
                // Auto-fill forms with demo data
                document.getElementById('signin-email').value = 'test@alcaponeclub.com';
                document.getElementById('signin-password').value = 'password123';
                
                document.getElementById('signup-username').value = 'testuser';
                document.getElementById('signup-email').value = 'test@example.com';
                document.getElementById('signup-phone').value = '+254712345678';
                document.getElementById('signup-password').value = 'password123';
                document.getElementById('signup-confirm').value = 'password123';
                
                console.log('Demo mode: Forms pre-filled');
            }
        });