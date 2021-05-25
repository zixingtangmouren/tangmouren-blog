<!--
 * @Author: tangzhicheng
 * @Date: 2021-04-20 18:10:06
 * @LastEditors: tangzhicheng
 * @LastEditTime: 2021-05-16 13:56:50
 * @Description: file content
-->

# 实现一个简单的 Vue3

## 前言

最近自己写了一个简易版的 Vue3 玩一玩，当然啦，里面没有 patch 和编译的部分（因为能力有限）😂，所以像分享一下自己在这个过程中学到的东西。该篇主要是以如何实现一个简单 Vue3 的方式，来讲解源码的设计和基本原理。

## 要做什么

在做之前，先想一下要做啥，所以简单列了一个清单：

1. 搞懂 setup 选项
2. 实现响应式核心 reactive 函数
3. 实现异步队列的机制
4. 实现 effect 函数
5. 实现 watch， computed，watchEffect 函数

这些是我在大致看了源码之后，总结出来的 Vue3 主要部分，也是我们日常开发会经常接触到的部分。接下来，我们就来完成这些清单，并在一步步实现中，搞懂 Vue3 的大致原理。

## 初始化选项 setup

这里我先来看一下 Vue3 中 setup 的用法：

```js
<template>
  <div>
    <h1 @click="onClick">{{ msg }}</h1>
    <h2>{{ state.name }}</h2>
    <h2>{{ state.age }}</h2>
    <h2>{{ doubleAge }}</h2>
  </div>
</template>

import { defineComponent, reactive, onBeforeMount, computed } from 'vue'

export default defineComponent({
  name: 'App',
  props: {
    msg: String,
  },
  setup(props) {
    const state = reactive({
      name: 'tangmouren',
      age: 18
    })

    const doubleAge = computed(() => state.age * 2)

    const onClick = () => {
      console.log(msg)
    }

    onBeforeMount(() => {
      console.log(props.msg)
    })

    return {
      state,
      doubleAge,
      onClick
    }
  }
})
```

我们来分析它是如何运行的。

首先它是一个函数。它会将组件中需要的数据和方法通过一个对象返回。这个有点像 Vue2 中的 data 选项，用函数返回一个数据对象，其实它们的道理一致，都是将组件需要的东西 return 出去。所以在组件初始化时会执行这些函数，获取返回的对象并进行相关处理，最后统一挂载至组件实例上。

这里可以简单实现一下：

```js
function Vue(options) {
  const { setup } = options
  const setupResult = setup()
  this.ctx = setupResult
}
```

然后组件渲染的时候就可以通过这个 ctx 访问到这些数据和方法了，这里展示一个 Vue3 模板编译的例子：

```js

  <div>
    <h1 @click="onClick">{{ msg }}</h1>
    <h2>{{ state.name }}</h2>
    <h2>{{ state.age }}</h2>
    <h2>{{ doubleAge }}</h2>
  </div>

  // 会被编译成：

export function render(_ctx, _cache, $props, $setup, $data, $options) {
   return (_openBlock(), _createBlock("div", null, [
    _createVNode("h1", { onClick: _ctx.onClick }, _toDisplayString(_ctx.msg), 9 /* TEXT, PROPS */, ["onClick"]),
    _createVNode("h2", null, _toDisplayString(_ctx.state.name), 1 /* TEXT */),
    _createVNode("h2", null, _toDisplayString(_ctx.state.age), 1 /* TEXT */),
    _createVNode("h2", null, _toDisplayString(_ctx.doubleAge), 1 /* TEXT */)
  ]))
}
```

## 响应式核心 reactive 函数

前面咱们已经小试身手的写了几行代码了，这个“宏伟”的工程已经开始了。接下来，就是 Vue 中最为核心的部分，也是我认为任何一个 Vue 开发者必须懂的部分。

### 老生常谈的响应式原理

先来梳理一下 Vue 一个关键的理念 --- 响应式设计。在响应式原理中最重要的三要素，就 **Watcher， Dep，Observer。** 正是由这三个要素实现了观察者模式（发布者/订阅者模式）。那这个模式，在 Vue2/Vue3 中是如何工作的呢，咱们先来搞懂这几个问题：

在框架中，谁是发布者，谁是订阅者：**对数据（data）进行拦截的那个对象，就是发布者。包含一个任务（函数）的对象/函数，就是订阅者(Vue2 是 Watcher，Vue3 是 Effect)。**

发布者和订阅者之间的关系：**发布者会去收集相关的订阅者，一旦发布者有动作，就会通知收集到的订阅者执行任务。**

发布者是如何收集订阅者的：**在渲染时会创建 VNode 并读取数据，所以发布者的某个数据一旦被访问，它就会把当前激活的订阅者存到对应的 Dep 中（这过程叫依赖收集）。**

关于依赖收集在读取数据的过程，可以看一下上面关于`template`编译成`render`函数的代码（这个编译过程是由 vue-loader 处理的）。因为创建`VNode`需要读取相关数据，所以一旦读取数据就会触发对应的依赖收集。

### Vue2 和 Vue3 在实现上的差异

Vue3 在响应式设计上肯定是不会发生太多变化的，所以大致逻辑基本跟 Vue2 一致，换汤不换药。但是在 Vue3 的部分核心逻辑上，还是做出了一定的优化和改变。

主要如下：

1. 在 Vue2 使用的`Object.defineProperty`实现的数据拦截，而在 Vue3 中则是采用`Proxy`去进行数据的代理。
2. `Dep`也不再存储在闭包中，而是使用`WeakMap，Map，Set`这些数据结构来全局的存储。
3. 之前是采用`Watcher`去实现订阅者，在 Vue3 则是采用`effect`这种副作用函数的形式。所以在依赖收集的过程中，收集的不再是`Watcher`而是`effect`函数。

### 实现 Observer

理清原理，可以开始干正事了。首先来实现三大要素中的第一位选手---观察者。

它有什么功能：

1. 对一个数据进行代理，拦截读写增删等操作（Proxy 不仅仅只能拦截读和写，有兴趣的可以去 MDN 详细去了解一下，本篇只考虑读写的情况）
2. 被读的时候，收集当前激活的`effect`函数存入`Dep`中
3. 当被修改时，执行`Dep`中所有的`effect`函数

在`Composition API`中，提供了一个`reactive`函数来实现 Vue 的响应式系统，将传入的对象用 proxy 进行响应式处理，并将其对象的代理返回。所以这里先来写一个`reactive`函数：

```js
// proxy对应的handler
const handler = {
  get: getter,
  set: setter
}

function reactive(target) {
  if (typeof target !== 'object') return target

  return createReactiveObject(target)
}

function createReactiveObject(target) {
  // 对当前这个对象进行响应式的处理并返回代理
  return new Proxy(target, handler)
}
```

这里不难看出，创建的发布者就是一个 Proxy。Proxy 会对目标对象进行访问拦截，因为目前只考虑对数据进行读和写的情况，所以只实现 set 和 get 的具体逻辑。

#### get

get 的主要截逻辑是数据被访问时，先读取目标对象的值，再为当访问的 key 收集`activeEffect`并存入对应`Dep`中。

这里先来实现读取值的逻辑（提示：留意一下访问的值是对象的时候）：

```js
// 当前激活的effect
let activeEffect

// 读取拦截
function getter(target, key, receiver) {
  // 读取目标对象对应属性的值
  const res = Reflect.get(target, key, receiver)
  // 让这个key收集当前激活的effect
  track(target, key)

  // 这里要考虑访问的属性可能是对象的情况
  // 需要进一步进行响应式处理
  // 这里也是Vue3的一个优化，下文会细说
  if (typeof res === 'object') {
    return reactive(res)
  }

  return res
}
```

重点是 track 的逻辑，它是依赖收集的关键，它会根据当前对象被访问的 key 找到对应 dep，然后将当前的`activeEffect`收集进去。

```js
// 收集依赖
function track(target, key) {
  if (activeEffect === undefined) {
    return
  }
  // 找到当前对象的dep集合
  let depsMap = targetMap.get(target)
  // 如果没有就创建一个新的dep集合
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 每个key都有自己对应的dep
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  if (!dep.has(activeEffect)) {
    // 保存当前的activeEffect
    dep.add(activeEffect)
  }
}
```

上面的代码就基本实现了数据被访问时收集依赖的功能。但是，还有两个点需要说明一下：

1. 一个是代码中用到的`targetMap, depsMap, dep`这几个数据结构
2. 访问的值是一个对象的时候的处理

先来看第一个点，前面也说到，Vue3 在对 Dep 的存储进行了改变，所以你先暂时认为这几个数据结构只是用来储存和查找 dep 的。dep 的实现，将放在后面来讲解。

然后是第二点，这个是一个**重点**。

为什么当访问的 key 对应的 value 是一个对象时，要做不一样的处理呢？

这里说一下 Vue2 是如何对一个对象进行响应式处理。 Vue2 它提供了一个`data`选项，这个选项一般都是一个对象，或者是返回一个对象的函数，在 Vue2 中响应式处理会将`data`提供的这个对象去深度的遍历，一旦某个属性的值是一个对象就会继续往下递归，去使用`Object.defineProperty`这 API 去进行拦截处理。大致实现如下：

```js
function observer(obj) {
  Object.keys(obj).forEach(key => {
    reactive(obj, key)
  })
}

function reactive(obj, key) {
  if (typeof obj[key] !== 'object') {
    Object.defineProperty(obj, key, {
      get() {
        //
      },
      set() {
        //
      }
    })
  } else {
    // 如果是一个对象，继续递归处理
    observer(obj[key])
  }
}
```

这种方式，这就会存在两个很大的性能问题：

1. 如果对象的层次很深，那递归的过程是很消耗性能。第一使用`Object.defineProperty`这个 API 需要遍历对象的每一个 key 进行处理，第二如果这个 key 对应的值又是一个对象，那么又需要进行递归的遍历处理。

2. 这样全面的递归响应式处理，还会产生一个问题，那就是如果对象的层次很深，但是里面很多的属性都没有在`template`中使用到，那给这些没有使用到的 key 增加的依赖收集，和通知订阅者的能力，就成了毫无意义的操作。

这里说一个我在工作中看到的例子：

在工作中经常会使用到一些第三方框架，像`Echart, Antv`这些数据可视化框架，还有`BMap, AMap`这些地图框架。但是我发现我们公司有的小伙伴，就会不小心做一个这样的事情，比如他在组件中使用一个可视化图表：

```js
import { Chart } from '@antv/g2'

export default {
  name: 'About',
  data() {
    return {
      barChart: {}
    }
  },
  mounted() {
    // 这里直接将创建好的图表实例赋值给了data里面的barChart
    this.barChart = new Chart({
      container: 'container',
      width: 600,
      height: 300
    })

    // 这里来输出看一下
    console.log(this.barChart)

    const data = [
      { year: '1951 年', sales: 38 },
      { year: '1952 年', sales: 52 },
      { year: '1956 年', sales: 61 },
      { year: '1957 年', sales: 145 }
    ]

    this.barChart.data(data)
    this.barChart.scale('sales', {
      nice: true
    })
    this.barChart.tooltip({
      showMarkers: false
    })
    this.barChart.interaction('active-region')
    this.barChart.interval().position('year*sales')
    this.barChart.render()
  }
}
```

看似这样的写法好像没什么问题，但是此时我们来看一下`barChart`的输出：

![1619682666(1).jpg](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d5f39849256841d4a0343c649885acf7~tplv-k3u1fbpfcp-watermark.image)

你可以发现，这个对象图表实例中所有的属性都被进行了响应式处理。你可以想一下，对这么庞大的一个对象进行递归的响应式处理，然后里面的数据在页面上一个都用不到，这难道不是一种性能的浪费吗？当然这也只是举一个例子，我相信大部分的人应该不会犯这种错误，因为如果不需要响应式的数据，也没有必要写在`data`中。

但是在 Vue3 中响应式处理的方式就有所不同，`reactive`并不会一开始就进行深度的处理，而是只对第一层进行代理。对于深层的对象，它的响应式处理是发生在 get 中。也就是说，如果深层对象的没有被访问，它就永远不会被响应式处理的，这种做法就大大提升了性能，节省了不必要的运行开销。

举个例子：

```js

// 在template中
<template>
  <div>{{ state.num }}</div>
  <div>{{ state.age }}</div>
</template>


// 在setup中声明一个响应式对象
 const state = reactive({
    num: 100,
    age: 18,
    person: {
      a: 1
    }
  })
```

因为在模板中没有访问`state.person.a`，所有`person`这个对象不会被处理成响应式，就算你如何修改它的值，也不会触发什么事件。

#### set

依赖收集的能力已经实现了，现在再来搞定通知订阅者的逻辑。因为发布者已经把相关的订阅者收集到对应的 dep 队列里面了，所以通知的逻辑，无非就是找到对应的 dep 然后逐一取出里面`effect`函数去执行。

代码实现：

```js
function setter(target, key, value, receiver) {
  // 修改值
  const res = Reflect.set(target, key, value, receiver)
  // 触发收集到的effect的执行
  trigger(target, key)
  return res
}

function trigger(target, key) {
  // 找到dep集合
  const depsMap = targetMap.get(target)

  if (!depsMap) return

  // 找到对应的dep
  const dep = depsMap.get(key)

  dep.forEach(effect => {
    // 如果effect存在一个调度的机制，就使用这个调度的方式去执行
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      // 直接执行这个`effect`
      effect()
    }
  })
}
```

这个 set 执行过程就是先修改值，然后执行 trigger 去找到当前 key 对应的 dep，最后遍历执行 dep 中的订阅者`effect`。

#### 简单试一下

上面响应式处理的大部分逻辑已经实现了，现在来简单测试一下。我们假设当前的`activeEffect`是一个`update`渲染更新函数：

```js
let activeEffect = function update() {
  console.log('渲染视图！')
}

// 这里是防止在触发setter的时候，没有这个options报错
// 后面实现effect的时候，会用到这个选项
activeEffect.options = {}
```

然后来创建一个组件：

```js
const vm = new Vue({
  setup() {
    const state = reactive({
      num: 100,
      person: {
        a: 1
      }
    })

    return {
      state
    }
  }
})

// 模拟render访问数据的过程
console.log(vm.ctx.state.num)
console.log(vm.ctx.state.person.a)

// 修改数据
vm.ctx.state.num = 666
vm.ctx.state.person.a = 999
```

来看一下结果：

![sds.jpg](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99eea96a04194f1caaf49461197d0216~tplv-k3u1fbpfcp-watermark.image)

nice，组件中的数据成功的收集到了`effect`，并且在访问的时候能够触发。

再来测试一个情况，假如深层对象的数据要是没有在`template`中被使用到，是否会被处理成响应式的呢？为了能准确的看到是哪个数据触发的更新，我们稍微改变一下原有的代码：

```js
// 改变一下update函数
let activeEffect = function update(key) {
  console.log(`${key} --- 触发的更新视图！`)
}

activeEffect.options = {}
```

```js
// trigger在执行effect的逻辑也稍微改一下
if (effect.options.scheduler) {
  // ...
} else {
  // 传递当前的key的给update
  effect(key)
}
```

例子：

```js
// 这里只单独的去访问num
console.log(vm.ctx.state.num)

// 修改数据
vm.ctx.state.num = 666
vm.ctx.state.person.a = 999
```

再来看一下结果：

![6sd8sd.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/530b2644f11543529d3f75b03c65a50e~tplv-k3u1fbpfcp-watermark.image)

非常的 nice，person 没有被访问，它并没有被响应式处理，所以不能触发`update`函数。

### 实现 Dep

Vue 中的三大重要素，已经实现了一个`Observer`，接下来我们实现用来存放订阅者的地方 --- Dep。

在开始这个小节的时候，你首先得对`WeakMap, Map, Set`这几个数据结构有所了解。先来回顾一下 Vue2 是怎么存这个 Dep 的，在对象的每个 key 进行拦截处理的时候，在函数内部创建一个 dep，也就是将每一个 key 对应的 dep 保存在一个函数闭包中，大致实现如下：

```js
function reactive(obj, key) {
  // 在处理每个key的时候，在函数内部创建一个dep
  const dep = new Dep()

  if (typeof obj[key] !== 'object') {
    Object.defineProperty(obj, key, {
      get() {
        //
      },
      set() {
        //
      }
    })
  } else {
    observer(obj[key])
  }
}
```

在 Vue3 中，我觉得 Dep 实现就比 Vue2 清晰简单很多。它其实就是几个数据结构。可以回看上面在实现 getter 的时候，用到的那几个变量`targetMap , depsMap , dep`。先来看这个 targetMap，其实它就是一个全局的`WeakMap`:

```js
const targetMap = new WeakMap()
```

这玩意是用来存数据对象（target）和 dep 集合（depsMap）对应关系的。就像代码中写的：

```js
let depsMap = targetMap.get(target)

if (!depsMap) {
  // 如果没有depsMap就创建一个
  targetMap.set(target, (depsMap = new Map()))
}

// 每个key都有自己对应的dep
let dep = depsMap.get(key)
if (!dep) {
  depsMap.set(key, (dep = new Set()))
}
```

当对一个对象使用`reactive`的时候，就会把当前这个对象的引用设为 targetMap 的一个键，然后创建一个新的 Map，也就是 depsMap，将其设为这个键的值。因为`WeakMap`的键是一个对象的引用，所以在后续的 getter 或者 setter 逻辑中直接通过 target 就能找到对应的 depsMap。所以你可以认为 targetMap 存的是一个`target -> depsMap`的对应关系。

那 depsMap 又是什么玩意？其实和`WeakMap`差不多，也是存的一个对应关系。在响应式原理中，一个 key 就对应这一个 dep，所以 depsMap 存的是对象所有的 key 和每个 key 对应 dep 的关系。在进行依赖收集的时候，会通过这个 target 找到对应的 depsMap，然后通过 key，来找到对应的 dep，最后在把当前的`activeEffect`存入 dep 中。

下面我画了一个简单的示意图，具体关系如下：

![niubi.jpg](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67b7cb85e54743968a201ca34478c430~tplv-k3u1fbpfcp-watermark.image)

### 实现 effect

终于到了最后一个要素 --- 订阅者 effect。

这也是 Vue3 响应式原理中，非常重要的一个角色。因为组件的很多工作都是靠订阅者的执行来驱动的。那这些订阅者具体是怎么工作的呢？

#### Vue2 / Vue3 订阅者的区别

Vue2 的订阅者是通过`Watcher`这个类实现的，然后 Dep 这个类有一个 target 的静态属性，用来记录当前正在激活的 watcher。当创建 `Watcher`实例的时候，实例会将自身的引用赋值给这个 target，渲染过程中发生依赖收集的时候就会将当前的 Dep.target 收集进来。其实 Vue3 也是这个道理，就是`Watcher`变成了`effect`函数，Dep.target 变成了`activeEffect`这个变量。

在 Vue3 中采用的 `effect` 函数，来实现订阅者。它允许你传入一个函数和一些配置项，并返回一个包装过的新函数。为了便于区分，我们把这个返回的新函数称为`reactiveEffect`。这个`reactiveEffect`执行时，会在不修改传入函数逻辑的情况下，扩展一个新的逻辑 --- 将自己身赋值给`activeEffect`。

在 Vue3 中是这样为组件创建`effect`渲染函数的：

```js
// instance是组件实例
instance.update = effect(
  // 需要包装的渲染函数
  function componentEffect() {
    console.log('渲染组件')
  },
  {
    // 创建完就立即执行
    lazy: false
  }
)
```

当一个组件挂载的时候，会通过这个`effect`去包装渲染函数，生成一个`render effect`并立即执行它。`render effect`在执行`componentEffect`之前会将`activeEffect`指向这个自己。接着，在组件渲染过程中被访问的数据，就会收集到这个`activeEffect`，所以一旦数据更新，就能触发视图的渲染更新。

那么这个`effect`函数是如何做到，在不侵入原来的代码的情况，加上额外逻辑的呢？

#### 包装函数

首先讲一个概念 --- wrapper 函数。它是在函数式编程里面常用的一个编程手法。

写一个普通的函数：

```js
function run() {
  console.log('run')
}
```

现在我需要这个函数在执行的时候，打印开始执行的时间，但是不能改原有函数的代码。此时，就可以使用 wrapper 函数。

```js
// 实现一个包装函数
function wrapper(fn) {
  return function() {
    // 写需要扩展的前置逻辑
    console.log(new Date())
    return fn(...arguments)
  }
}

// 得到一个新的函数
const runAndPrintDate = wrapper(run)

runAndPrintDate()

// 输出结果：
// Fri May 07 2021 16:22:52 GMT+0800 (中国标准时间)
// run
```

该方式就实现了既不修改原来函数的代码，又能扩展新的逻辑。其实`effect`函数实现的原理也是如此。

#### effect 实现

effect 的具体实现：

```js
// effect执行栈
const effectStack = []

function effect(fn, options) {
  // 创建一个包装过的函数
  const effect = createReactiveEffect(fn, options)
  // lazy可以决定是否立即执行
  if (!options.lazy) {
    effect()
  }

  return effect
}

// createReactiveEffect就是那个wrapper函数
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    if (!effectStack.includes(effect)) {
      try {
        // 正在执行的effect推入执行栈
        effectStack.push(effect)
        activeEffect = effect
        return fn()
      } finally {
        // 这里希望执行完毕的effect退出执行栈
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
```

以上代码有两个点要注意一下，分别是`effectStack`和`options`参数。

`effectStack`是一个记录`effect`的执行栈，它主要是解决一个`effect`嵌套调用的情况，这个概念在实现 computed 章节中会细说。

重点来看`options`，因为在 Vue 中订阅者的类型有多种，它们在不同的应用场景会出现不同的需求，所以需要用一个`options`来配置不同的情况。就比如上面给组件实创建`render effect`的时候，就会配置一个`lazy`为 false 的属性。因为在组件初次挂载的时候，希望在创建`render effect`时马上执行去渲染 VNodeTree。但是有些场景，又不需要在创建的时候它马上执行，比如创建监听器或者计算属性的时候。但是，在`options`这个配置里面，最重要的还是`scheduler`这个属性。可以看到在`trigger`函数的执行中有一个很重要的步骤，就是在执行 dep 里面所有`effect`时，会判断是否有`scheduler`存在，如果有就是会使用`scheduler`去调度的执行。

那为什么需要`scheduler`这种设计呢？我们重点看一下 Vue 中异步队列机制的实现。

## 实现异步队列的机制

咱们先不管异步队列机制是什么，先来看原先实现的代码有没有什么问题。来写一个例子：

```js
const vm = new Vue({
  setup() {
    const state = reactive({
      num: 100,
      person: {
        a: 1
      }
    })

    return {
      state
    }
  }
})

// 模拟组件挂载时生成的render effect
effect(
  function componentEffect() {
    // 模拟渲染过程中，访问值
    console.log(vm.ctx.state.person.a)
    console.log('渲染组件')
  },
  {
    lazy: false
  }
)

// 修改数据
while (vm.ctx.state.person.a <= 100) {
  vm.ctx.state.person.a++
}

// 打印100次 “渲染组件”
```

在这个例子中，修改了`state.person.a`这个变量 100 次，'渲染组件'就会被打印 100 次。要知道渲染组件其实有一个非常复杂的过程 --- patch。

这过程会创建新的 VNodeTree，然后和旧的 VNodeTree 进行一个递归的比对，比对过程中会找出操作 dom 的最优方式，但是这个过程其实是比较麻烦的，它需要递归处理很多很多事情。如果每修改一次数据就执行一遍这个过程，其实是一种性能的浪费，那还不如直接操作 dom 来的快。

那在 Vue 中是如何解决这个问题的呢？

### 实现

因为在 Vue 中有一种异步队列的机制，会把使用该机制的任务先缓存起来，等到所有数据都修改完毕，这些任务才会被执行。

这种机制的核心就如它的名字，就是“队列”和“异步”。所谓“队列”，就是一个缓存任务的数组，所有通过这种机制调度执行的任务，会被缓存到队列中并且是去重的。至于“异步”就是执行数组中任务的方式，它会把一个执行“队列”里全部任务的方法推入微任务队列中，等到该轮宏任务执行完毕在执行，以此方式来保证所有的任务的“汇总”延后执行。那这种机制是如何具体实现的呢？

先来实现一下缓存任务的过程：

```js
// 任务队列
const queue = []

function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

function queueFlush() {
  // 执行任务
}
```

缓存任务这个步骤搞定了，现在可以把这个`queueJob`赋值给`scheduler`了。

```js
// 模拟组件挂载时生成的渲染effect
effect(
  function componentEffect() {
    console.log('渲染组件')
  },
  {
    lazy: false,
    scheduler: queueJob
  }
)
```

这样在修改数据的时候，就会将当前这个`effect`先存入到队列里面，并还能保证每一个`effect`的唯一性。但是还有一个问题，在什么时机去执行`queue`的任务最合适呢？

假如直接把`queueFlush`写成这样：

```js
function queueFlush() {
  // 执行任务
  queue.forEach(job => job())
  queue = []
}
```

那这个队列就毫无意义了，因为代码都是同步的原因，即使存了也是每次修改都会直接执行渲染，所以必须想办法让执行过程延后到所有赋值逻辑走完之后。这就得采用异步的方式，让渲染执行任务延后。那延迟到何时才是最好的呢？当然是当前宏任务执行完毕，开始执行微任务的时候。所以把执行时机放在微任务中是最好的。

来改一下我们的代码：

```js
// 任务队列
const queue = []

// 用来标记是否开启了一个微任务队列
let isFlushPending = false
// 用来标记queue中的任务是否正在执行
let isFlushing = false

function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job)
    queueFlush()
  }
}

function queueFlush() {
  if (!isFlushPending && !isFlushing) {
    isFlushPending = true
    // 通过then方法将执行任务的方法（flushJobs）推入微任务队列
    Promise.resolve().then(flushJobs)
  }
}

// 执行任务
function flushJobs() {
  isFlushPending = false
  isFlushing = true
  queue.forEach(job => job())
  queue.length = 0
  isFlushing = false
}
```

这里来理一下上面的逻辑，假如在某一个交互事件中，改变了某个组件的很多个数据。这些数据对应的`trigger`逻辑都会触发，然后都使用`scheduler`去调度执行对应`effect`。此时第一个数据的修改执行了`queueJob`将该组件的`render effect`推入了任务队列`queue`中，然后执行`queueFlush`将任务刷新函数`flushJobs`推入微任务队列中，并进行一个标记，表示在微任务中已经推入了一个刷新任务的函数。这样第二次，乃至第 n 次数据的修改都不会把`flushJobs`推入到微任务中，而且`queue`中也只会有一个`render effect`。一旦本次宏任务执行完毕，根据 js 的事件循环机制，开始执行微任务，就把`flushJobs`压入执行栈中，这就是多次数据修改，只渲染一次的工作流程。

这里来简单画一个流程图：

![WechatIMG1607.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9b017dcb8481476d95478abf0d89f1ac~tplv-k3u1fbpfcp-watermark.image)

这轮交互事件执行完毕，js 的执行栈开始向微任务队列拿任务执行，拿到`flushJobs`并执行，将`queue`中全部的任务执行完毕，整个异步更新的流程就走完了。

### 测试

这里改一下原来创建的 effect:

```js
// 模拟组件挂载时生成的渲染effect
effect(
  function componentEffect() {
    // 模拟渲染过程中，访问值
    console.log(vm.ctx.state.person.a)
    console.log('渲染组件')
  },
  {
    lazy: false,
    scheduler: queueJob
  }
)
```

继续使用上面的例子来运行：

```js
// 修改值
while (vm.ctx.state.person.a <= 100) {
  vm.ctx.state.person.a++
}
```

结果：

![46136dbf5050f717b1bd3562137f6ae.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d7f53d97123d4eb688bae93b0cd97105~tplv-k3u1fbpfcp-watermark.image)

非常 nice，就算这个值被改了 100 次，但是也只会渲染最后一次修改的状态。

## 实现 watch

在响应式原理中有说到，在渲染过程中数据可以自己去收集渲染函数`render effect`，一旦数据更新就会自动触发再次渲染。那有没有什么方法让我们手动去给某些数据增加事件，在数据变更的时候自动去执行呢？

Watch 这个 API 就解决了这个需求。它允许我们去监听响应式的数据，然后在数据变更时执行回调。它是依赖于`effect`去实现的，因为被`effect`包装过的函数可以在执行前，将当前的`activeEffect`指向自己，所以通过`watch`创建的`watch effect`在执行时会对需要监听的值进行一次 get，这样被监听的数据就可以收集到这个`watch effect`，在数据变动时，就会触发`scheduler`中的回调。

代码实现：

```js
function watch(getter, callback) {
  if (typeof getter !== 'function') {
    return
  }

  let _getter = getter
  let oldValue

  /**
   * 执行回调
   * 计算新的值，缓存旧的值
   */
  function job() {
    const newValue = getter()
    callback(newValue, oldValue)
    oldValue = newValue
  }

  // 创建watch effect
  const runner = effect(_getter, {
    lazy: true,
    scheduler: () => {
      // 异步调度的方式去执行
      queueJob(job)
    }
  })

  oldValue = runner()
}
```

来测试一下：

```js
const vm = new Vue({
  setup() {
    const state = reactive({
      num: 100
    })

    watch(
      () => state.num,
      (newVal, oldVal) => {
        console.log('触发监听器', newVal, oldVal)
      }
    )

    return {
      state
    }
  }
})

// 模拟组件挂载时生成的渲染effect
effect(
  function componentEffect() {
    // 模拟渲染过程中，访问值
    console.log(vm.ctx.state.num)
    console.log('渲染组件')
  },
  {
    lazy: false,
    scheduler: queueJob
  }
)

vm.ctx.state.num = 200
```

看一下结果：

![4f8c08f76bb3b10046660d9e9e1f945.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e040e670a55d4fab953d9399036f7e79~tplv-k3u1fbpfcp-watermark.image)

watch 的实现就搞定了。

## 实现 computed

计算属性这个 API 是 Vue 中的一个特色。它可以创建一个 computed 对象，然后内部的 value 可以根据依赖的数据进行计算获取得新的值，并触发页面的渲染。

这次看一下完整的代码实现：

```js
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

  // 创建computed effect
  let runner = effect(_getter, {
    lazy: true,
    scheduler: () => {
      if (!_dirty) {
        // 当依赖的响应式数据发生变化
        // 会将computed标记为脏值
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
```

computed 的原理和实现，可能理解起来会比较麻烦一点，也比较绕，所以这里我直接来讲已经写好的代码。上面的代码主要分为三个部分：标准化参数，创建 runner 函数，创建 computed 对象并返回。

标准化参数就是将用户传入 getter 的不同情况做了处理，因为该 API 是允许用户传入一个单独的 getter，或者是一个包含 getter 和 setter 的对象的。这里我们重点来看 runner 函数，和创建的 computed 对象。

### runner 函数

runner 函数是对 getter 的封装。它执行时会改变`actvieEffect`指向自身，然后执行 getter 计算新的值，让 getter 函数内依赖的响应式数据收集到 runner。在这些数据变化时，会执行 runner 身上的 scheduler。

### computed 对象

这个对象维护了一个 value 值，当 computed 的 value 在渲染时被访问会发生什么呢？

因为初始化的时候 dirty 默认是 true，所以会执行 runner 来计算新的值并且让 getter 中依赖的数据收集到 runner，接着是`track(_computed, 'value')`，让 computed 的 value 收集`actvieEffect`，因为访问 value 是发生在渲染过程中，所以 value 收集的是渲染函数`render effect`。

现在有两个问题：

1. getter 中依赖的数据收集到 runner 的作用是什么
2. 为什么执行完 runner 后，computed 还能收集到 `render effect`

第一个问题。当依赖的数据发生变化时会执行 runner 的 scheduler 中的逻辑，它是先将 dirty 标记为 true 来告诉 computed 这是一个脏值，并不会马上去重新计算新的值，并且会去触发渲染更新。等到再次渲染时访问到 computed 时，发现 dirty 是 true，就会重新进行计算。

第二个问题。虽然 computed 的访问是发生在渲染过程中，当前的`actvieEffect`是`render effect`。但是执行 runner 的时候，runner 已经将当前的`actvieEffect`指向自己了，为什么后续的`track(_computed, 'value')`收集的是 `render effect`呢？

因为对于这种`effect`嵌套使用的情况，Vue 设计了一个`effectStack`。可以在回看一下`effect`章节的代码:

```js
if (!effectStack.includes(effect)) {
  try {
    // 正在执行的effect推入执行栈
    effectStack.push(effect)
    activeEffect = effect
    return fn()
  } finally {
    // 这里希望执行完毕的effect退出执行栈
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
}
```

`effect`的执行会把自己推入`effect`的执行栈并将`actvieEffect`指向自己，当它执行完后，就会将自己退出栈，并`actvieEffect`会执行指向栈顶，也就上一个`effect`。这个设计就很好解决了`effect`嵌套调用的情况。

这里来假设一个情况。当 runner 执行完毕，如果没有将当前的`actvieEffect`退回到上一个`effect`，那在 computed 收集的时候就是收集到 runner 了。这就是一个错误的依赖收集，本来正常的逻辑应该是：依赖数据收集 runner，computed 收集渲染函数，这样依赖数据被修改才能告诉 computed，并触发 computed 收集到的渲染函数去重新渲染，但是由于 runner 执行完没有正确退出栈，就会导致 computed 没有渲染函数可以触发。

## 实现 watchEffect

watchEffect 的实现就相对比较简单了。

```js
function watchEffect(cb) {
  return effect(cb, {
    scheduler: queueJob
  })
}
```

这 API 更像是`effect`的一个封装，它会立即执行传入进来的回调函数，如果回调函数中有使用到响应式的数据，这些数据就会收集到这个`watchEffect`，数据变更就触发执行它。

## 最后

第一次写这种超长篇的文章 😂。感觉自己在逻辑梳理上还是有很多欠缺，可能里面有些东西讲的也不是很清楚，如果啥说的不对，或者讲的不是很清楚，希望大佬们能在评论区指点一下。如果对你稍微有那么一点点帮助的话，能否点赞关注一波，我会继续努力的。
