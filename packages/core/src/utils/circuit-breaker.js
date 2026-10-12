/**
 * packages/core/src/utils/circuit-breaker.js — Circuit Breaker Pattern
 * ---------------------------------------------------------------------
 * Implements circuit breaker pattern to prevent cascading failures.
 * States: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery).
 */

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 seconds
    
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Execute an async operation with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @returns {Promise} - Result of the function or throws if circuit is open
   */
  async execute(fn) {
    // Check if we should attempt to recover
    if (this.state === STATES.OPEN) {
      const now = Date.now();
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        this.state = STATES.HALF_OPEN;
        console.log(`Circuit breaker half-open for ${this.name}, attempting recovery`);
      } else {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      console.log(`Circuit breaker closed for ${this.name}`);
      this.state = STATES.CLOSED;
    }
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Record a failed operation
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATES.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      this.state = STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      console.log(`Circuit breaker reopened for ${this.name}`);
    } else if (this.failureCount >= this.failureThreshold) {
      // Open the circuit if we've hit the threshold
      this.state = STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      console.log(`Circuit breaker opened for ${this.name}`);
    }
  }

  /**
   * Get current circuit breaker state
   * @returns {string} - Current state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState() {
    return this.state;
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}

export default CircuitBreaker;
