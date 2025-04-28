class MoviePicker {
    constructor() {
        this.API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxNjE0OWIyZWIwZDgyYjg5NDMzOTc5OTIwMzU3ZDZkMyIsIm5iZiI6MTc0NTc5MTY2OS4yMywic3ViIjoiNjgwZWFhYjU1YTliNzhkMjcyODEyODliIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.n1kBGIpzO5t2gI1IRmYHeEo_3nekmnoZfMuMPqYCfq8';
        this.BASE_URL = 'https://api.themoviedb.org/3';
        this.IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
        
        // DOM elements
        this.card = document.getElementById('movieCard');
        this.poster = document.getElementById('moviePoster');
        this.title = document.getElementById('movieTitle');
        this.description = document.getElementById('movieDescription');
        this.rating = document.getElementById('movieRating');
        
        // Touch handling
        this.startX = 0;
        this.currentX = 0;
        this.isDragging = false;
        
        // Movie management
        this.seenMovies = new Set();
        this.isLoading = false;
        this.currentMovie = null;
        
        this.initializeEventListeners();
        this.loadRandomMovie();
    }
    
    initializeEventListeners() {
        // Mouse events
        this.card.addEventListener('mousedown', e => this.startSwipe(e.clientX));
        document.addEventListener('mousemove', e => this.moveSwipe(e.clientX));
        document.addEventListener('mouseup', () => this.endSwipe());
        
        // Touch events
        this.card.addEventListener('touchstart', e => this.startSwipe(e.touches[0].clientX));
        document.addEventListener('touchmove', e => {
            e.preventDefault();
            this.moveSwipe(e.touches[0].clientX);
        }, { passive: false });
        document.addEventListener('touchend', () => this.endSwipe());
    }
    
    startSwipe(clientX) {
        if (this.isLoading) return;
        this.isDragging = true;
        this.startX = clientX;
        this.card.style.transition = 'none';
    }
    
    moveSwipe(clientX) {
        if (!this.isDragging) return;
        
        this.currentX = clientX - this.startX;
        const rotation = this.currentX * 0.1;
        
        this.card.style.transform = `translateX(${this.currentX}px) rotate(${rotation}deg)`;
        
        // Add swipe direction classes
        if (this.currentX > 0) {
            this.card.classList.add('swipe-right');
            this.card.classList.remove('swipe-left');
        } else if (this.currentX < 0) {
            this.card.classList.add('swipe-left');
            this.card.classList.remove('swipe-right');
        } else {
            this.card.classList.remove('swipe-right', 'swipe-left');
        }
    }
    
    endSwipe() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        const swipeThreshold = 100;
        this.card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        
        if (Math.abs(this.currentX) > swipeThreshold) {
            const direction = this.currentX > 0;
            const moveOutWidth = window.innerWidth * 1.5;
            const rotation = this.currentX * 0.1;
            
            this.card.style.transform = `translate(${direction ? moveOutWidth : -moveOutWidth}px, 0) rotate(${rotation}deg)`;
            this.card.style.opacity = '0';
            
            setTimeout(() => {
                this.handleSwipe(direction);
            }, 300);
        } else {
            this.resetCard();
        }
        
        this.currentX = 0;
    }
    
    async handleSwipe(liked) {
        if (!this.currentMovie) return;
        
        const currentTitle = this.currentMovie.title;
        
        // Log current movie info
        console.log(`Swiped ${liked ? 'right' : 'left'} on: ${currentTitle}`);
        console.log(`Genres: [${this.currentMovie.genre_ids.join(', ')}]`);
        
        // Reset card and load next movie
        this.resetCard();
        await this.loadRandomMovie(this.currentMovie.id, liked);
    }
    
    async loadRandomMovie(previousMovieId = null, liked = null) {
        try {
            this.isLoading = true;
            this.card.classList.add('loading');
            
            // First, get total pages available
            let endpoint;
            if (previousMovieId === null) {
                // Initial load - get popular movies
                endpoint = `${this.BASE_URL}/discover/movie?` +
                          `sort_by=popularity.desc&` +
                          `vote_count.gte=1000&` +
                          `vote_average.gte=7&` +
                          `page=1`;
            } else {
                // Get recommendations based on previous movie
                endpoint = `${this.BASE_URL}/movie/${previousMovieId}/` +
                          `${liked ? 'similar' : 'recommendations'}?` +
                          `page=1`;
            }
            
            // First request to get total pages
            const initialResponse = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!initialResponse.ok) throw new Error(`HTTP error! status: ${initialResponse.status}`);
            const initialData = await initialResponse.json();
            
            // Calculate random page within available range
            const totalPages = Math.min(initialData.total_pages, 5); // Cap at 5 pages
            const page = totalPages > 1 ? Math.floor(Math.random() * totalPages) + 1 : 1;
            
            // Get data from random page if needed
            let data = initialData;
            if (page > 1) {
                endpoint = endpoint.replace('page=1', `page=${page}`);
                const pageResponse = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${this.API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!pageResponse.ok) throw new Error(`HTTP error! status: ${pageResponse.status}`);
                data = await pageResponse.json();
            }
            
            // Filter eligible movies
            const eligibleMovies = data.results.filter(movie => 
                !this.seenMovies.has(movie.id) && 
                movie.vote_average >= (liked ? 6 : 5.5) &&
                movie.vote_count >= (liked ? 500 : 300) &&
                movie.poster_path
            );
            
            if (eligibleMovies.length === 0) {
                console.log('No recommendations found, loading a popular movie');
                return this.loadRandomMovie(); // Start over with popular movies
            }
            
            // Pick one random movie from eligible movies
            const randomIndex = Math.floor(Math.random() * eligibleMovies.length);
            const movie = eligibleMovies[randomIndex];
            
            // Update current movie and display it
            this.currentMovie = movie;
            this.seenMovies.add(movie.id);
            
            // Update UI
            this.title.textContent = movie.title;
            this.description.textContent = movie.overview;
            this.rating.textContent = movie.vote_average.toFixed(1);
            this.poster.src = `${this.IMAGE_BASE_URL}${movie.poster_path}`;
            this.poster.alt = movie.title;
            
            console.log(`Loaded: ${movie.title} - Genres: [${movie.genre_ids.join(', ')}]`);
            
        } catch (error) {
            console.error('Error loading movie:', error);
            this.title.textContent = 'Error loading movies';
            this.description.textContent = 'Please try again later';
        } finally {
            this.isLoading = false;
            this.card.classList.remove('loading');
        }
    }
    
    resetCard() {
        this.card.style.transform = 'none';
        this.card.style.opacity = '1';
        this.card.classList.remove('swipe-right', 'swipe-left');
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    new MoviePicker();
});
