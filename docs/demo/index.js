/**
 * @Author: tangzhicheng
 * @Date: 2021-04-27 11:37:29
 * @LastEditors: tangzhicheng
 * @LastEditTime: 2021-05-11 09:58:35
 * @Description: file content
 */

const targetMap = new WeakMap()
let uid = 0

let activeEffect
const effectStack = []

const queue = []

let currentFlushPromise

let isFlushPending = false
let isFlushing = false

function effect(fn, options) {
  const effect = createReactiveEffect(fn, options)

  if (!options.lazy) {
    effect()
  }

  return effect
}

function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    if (!effectStack.includes(effect)) {
      try {
        effectStack.push(effect)
        activeEffect = effect
        return fn()
      } finally {
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  }

  effect.id = uid++
  effect.raw = fn
  effect.options = options

  return effect
}

function Vue(options) {
  const {
    setup
  } = options
  const setupResult = setup()
  this.ctx = setupResult
}

function getter(target, key, receiver) {
  const res = Reflect.get(target, key, receiver)
  track(target, key)

  if (typeof res === 'object') {
    return reactive(res)
  }

  return res
}

function track(target, key) {
  if (activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    // activeEffect.deps.push(dep);
  }
}

function setter(target, key, value, receiver) {
  const res = Reflect.set(target, key, value, receiver)
  trigger(target, key)
  return res
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)

  dep.forEach(effect => {
    // 如果effect存在一个调度的机制，就使用这个调度去执行
    // 这里涉及到后面要说异步队列机制，计算属性等等
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      // 直接执行这个`effect`
      effect()
    }
  })
}

const handler = {
  get: getter,
  set: setter
}

function reactive(target) {
  if (typeof target !== 'object') return target

  return createReactive(target)
}

function createReactive(target) {
  return new Proxy(target, handler)
}

function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

function queueFlush() {
  if (!isFlushPending && !isFlushing) {
    isFlushPending = true
    currentFlushPromise = Promise.resolve().then(flushJobs)
  }
}

function flushJobs() {
  isFlushPending = false
  isFlushing = true
  queue.forEach(job => job())
  isFlushing = false
}

function computed(options) {
  let _getter
  let _setter
  let _computed
  let _value
  let _dirty = true

  if (typeof options === 'function') {
    _getter = options
    _setter = () => {
      console.warn('computed _ is readonly')
    }
  } else {
    _getter = options.get
    _setter = options.set
  }

  let runner = effect(_getter, {
    lazy: true,
    scheduler: () => {
      if (!_dirty) {
        _dirty = true
        trigger(_computed, 'value')
      }
    }
  })

  _computed = {
    get value() {
      // 如果数据是脏才重新计算
      if (_dirty) {
        _value = runner()
        _dirty = false
      }
      track(_computed, 'value')
      return _value
    },
    set value(newValue) {
      return _setter(newValue)
    }
  }

  return _computed
}

function watch(getter, callback) {
  if (typeof getter !== 'function') {
    return;
  }

  let _getter = getter
  let oldValue

  function handler() {
    const newValue = getter()
    callback(newValue, oldValue)
    oldValue = newValue
  }

  const runner = effect(_getter, {
    lazy: true,
    scheduler: () => {
      queueJob(handler)
    }
  })

  oldValue = runner()
}


const vm = new Vue({
  setup() {
    const state = reactive({
      num: 100,
      person: {
        a: 1
      }
    })

    const doubleNum = computed(() => state.num * 2)

    watch(() => state.num, (newVal, oldVal) => {
      console.log('触发监听器', newVal, oldVal)
    })

    return {
      state,
      doubleNum
    }
  }
})


// 模拟组件挂载时生成的渲染effect
effect(
  function componentEffect() {
    // 模拟渲染过程中，访问值
    console.log(vm.ctx.state.num)
    console.log(vm.ctx.state.person.a)
    console.log(vm.ctx.doubleNum.value)
    console.log('渲染组件')
  }, {
    lazy: false,
    scheduler: queueJob
  }
)


while (vm.ctx.state.person.a <= 100) {
  vm.ctx.state.person.a++
}

while (vm.ctx.state.num <= 200) {
  vm.ctx.state.num++
}