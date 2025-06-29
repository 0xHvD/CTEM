// stores/counter.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  // State
  const count = ref<number>(0)
  
  // Getters
  const doubleCount = computed<number>(() => count.value * 2)
  const isPositive = computed<boolean>(() => count.value > 0)
  const isEven = computed<boolean>(() => count.value % 2 === 0)
  
  // Actions
  function increment(): void {
    count.value++
  }
  
  function decrement(): void {
    count.value--
  }
  
  function incrementBy(amount: number): void {
    count.value += amount
  }
  
  function reset(): void {
    count.value = 0
  }
  
  function setCount(newCount: number): void {
    count.value = newCount
  }

  return { 
    // State
    count, 
    // Getters
    doubleCount, 
    isPositive,
    isEven,
    // Actions
    increment,
    decrement,
    incrementBy,
    reset,
    setCount
  }
})