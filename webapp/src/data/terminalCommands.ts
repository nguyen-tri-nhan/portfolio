export type TerminalCommandResult = {
  response: string
  clearHistory?: boolean
}

export type TerminalCommandContext = {
  scrollToExperience: () => void
  scrollToProjects: () => void
  scrollToContact: () => void
  scrollToTop: () => void
  openUrl: (url: string) => void
  resumeUrl: string
  history: string[]
  now: () => Date
  pickFortune: () => string
  helpText: string
}

export type TerminalCommandDefinition = {
  command: string
  aliases?: string[]
  description: string
  run: (context: TerminalCommandContext) => TerminalCommandResult
}

const FORTUNES = [
  'Today is a good day to ship something small.',
  'Tests pass. Confidence rises.',
  'Your next commit will be your best one yet.',
  'Take a break; breakthroughs happen off-screen too.',
  'The bug you fear is already 80% understood.'
]

export const COMMAND_DEFINITIONS: TerminalCommandDefinition[] = [
  {
    command: 'view_experience',
    description: 'scroll to the experience section',
    run: (context) => {
      context.scrollToExperience()
      return { response: 'Scrolling to experience...' }
    }
  },
  {
    command: 'view_projects',
    aliases: ['projects'],
    description: 'scroll to the projects section',
    run: (context) => {
      context.scrollToProjects()
      return { response: 'Scrolling to projects...' }
    }
  },
  {
    command: 'view_contact',
    aliases: ['contact'],
    description: 'scroll to the contact section',
    run: (context) => {
      context.scrollToContact()
      return { response: 'Scrolling to contact...' }
    }
  },
  {
    command: 'go_top',
    aliases: ['top'],
    description: 'jump back to the top',
    run: (context) => {
      context.scrollToTop()
      return { response: 'Back to the top.' }
    }
  },
  {
    command: 'github',
    aliases: ['go github'],
    description: 'open my GitHub profile',
    run: (context) => {
      context.openUrl('https://github.com/nguyen-tri-nhan')
      return { response: 'Opening GitHub...' }
    }
  },
  {
    command: 'linkedin',
    aliases: ['go linkedin'],
    description: 'open my LinkedIn profile',
    run: (context) => {
      context.openUrl('https://www.linkedin.com/in/nguyen-tri-nhan/')
      return { response: 'Opening LinkedIn...' }
    }
  },
  {
    command: 'resume',
    description: 'open my resume PDF',
    run: (context) => {
      context.openUrl(context.resumeUrl)
      return { response: 'Opening resume...' }
    }
  },
  {
    command: 'history',
    description: 'show recent commands',
    run: (context) => {
      const recent = context.history.slice(-5)
      if (recent.length === 0) {
        return { response: 'No command history yet.' }
      }
      return {
        response: `Recent commands:\n${recent
          .map((item, index) => `${index + 1}. ${item}`)
          .join('\n')}`
      }
    }
  },
  {
    command: 'date',
    aliases: ['time'],
    description: 'show the local time',
    run: (context) => ({ response: context.now().toLocaleString() })
  },
  {
    command: 'fortune',
    aliases: ['fortune_cookie'],
    description: 'get a quick fortune',
    run: (context) => ({ response: context.pickFortune() })
  },
  {
    command: 'coffee',
    aliases: ['brew'],
    description: 'request a coffee',
    run: () => ({ response: 'Brewing coffee... You can pay in pull requests.' })
  },
  {
    command: 'clear',
    description: 'clear the terminal output',
    run: () => ({ response: 'Terminal cleared.', clearHistory: true })
  },
  {
    command: 'help',
    description: 'show this list',
    run: (context) => ({ response: context.helpText })
  },
  {
    command: 'sudo',
    description: 'unlock boss mode',
    run: () => ({
      response: 'Nice try. Boss mode unlocks after the salary hits the account.'
    })
  }
]

export const buildCommandMap = (definitions: TerminalCommandDefinition[]) => {
  const commandMap = new Map<string, TerminalCommandDefinition>()
  definitions.forEach((definition) => {
    commandMap.set(definition.command, definition)
    definition.aliases?.forEach((alias) => {
      commandMap.set(alias, definition)
    })
  })
  return commandMap
}

export const buildHelpText = (definitions: TerminalCommandDefinition[]) => {
  return [
    'Available commands:',
    ...definitions.map((definition) => {
      const aliasText =
        definition.aliases && definition.aliases.length > 0
          ? ` (${definition.aliases.join(', ')})`
          : ''
      return `- ${definition.command}${aliasText}: ${definition.description}`
    })
  ].join('\n')
}

export const pickFortune = () => FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
