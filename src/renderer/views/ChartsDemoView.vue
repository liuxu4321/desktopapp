<script setup lang="ts">
import PageHeader from '@renderer/components/PageHeader.vue'

const bars = [44, 58, 52, 76, 68, 84, 73, 92, 81, 96, 88, 104]
const channels = [
  { label: 'Direct', value: 42, color: '#256f73' },
  { label: 'Search', value: 31, color: '#d9923b' },
  { label: 'Referral', value: 18, color: '#6674a8' },
  { label: 'Other', value: 9, color: '#8a989f' },
]
</script>

<template>
  <section class="page compact-page">
    <PageHeader
      title="Analytics"
      description="Traffic, usage and conversion performance over time."
    >
      <template #actions>
        <select aria-label="Analytics period">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
        </select>
      </template>
    </PageHeader>

    <div class="metric-strip">
      <div>
        <span>Active users</span><strong>12,482</strong><small class="positive">+8.4%</small>
      </div>
      <div><span>Sessions</span><strong>18,906</strong><small class="positive">+5.1%</small></div>
      <div><span>Conversion</span><strong>6.82%</strong><small class="negative">-0.3%</small></div>
      <div>
        <span>Avg. duration</span><strong>4m 18s</strong><small class="positive">+12.0%</small>
      </div>
    </div>

    <div class="chart-grid">
      <article class="chart-panel chart-panel-wide">
        <header>
          <div>
            <h2>Usage trend</h2>
            <p>Daily active sessions</p>
          </div>
          <strong>18.9k</strong>
        </header>
        <svg
          class="line-chart"
          viewBox="0 0 720 220"
          role="img"
          aria-label="Usage increased through the month"
        >
          <g class="chart-grid-lines">
            <line v-for="y in [30, 80, 130, 180]" :key="y" x1="0" :y1="y" x2="720" :y2="y" />
          </g>
          <polyline
            class="chart-area-line"
            points="0,176 65,158 130,164 196,120 261,138 327,94 392,112 458,66 523,84 589,42 654,62 720,28"
          />
        </svg>
      </article>

      <article class="chart-panel">
        <header>
          <div>
            <h2>Traffic sources</h2>
            <p>Share of sessions</p>
          </div>
        </header>
        <div class="donut-layout">
          <div class="donut-chart"><strong>100%</strong></div>
          <ul>
            <li v-for="channel in channels" :key="channel.label">
              <i :style="{ background: channel.color }"></i><span>{{ channel.label }}</span
              ><strong>{{ channel.value }}%</strong>
            </li>
          </ul>
        </div>
      </article>

      <article class="chart-panel chart-panel-wide">
        <header>
          <div>
            <h2>Monthly volume</h2>
            <p>Requests processed</p>
          </div>
        </header>
        <div class="bar-chart">
          <div v-for="(bar, index) in bars" :key="index">
            <span :style="{ height: `${bar}px` }"></span><small>{{ index + 1 }}</small>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
