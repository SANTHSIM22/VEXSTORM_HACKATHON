class RateLimiter {
    constructor(maxRequests = 10, windowMs = 1000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.tokens = maxRequests;
        this.lastRefill = Date.now();
    }

    async acquire() {
        this._refill();
        if (this.tokens > 0) {
            this.tokens--;
            return;
        }
        const waitTime = this.windowMs - (Date.now() - this.lastRefill);
        await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, 100)));
        this._refill();
        this.tokens--;
    }

    _refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        if (elapsed >= this.windowMs) {
            this.tokens = this.maxRequests;
            this.lastRefill = now;
        }
    }
}

module.exports = RateLimiter;
