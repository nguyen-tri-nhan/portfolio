import { Github, Linkedin, Mail, MapPin } from 'lucide-react'

export default function Contact() {

  return (
    <section id="contact" className="py-20 px-4 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Connect <span className="text-primary">With Me</span>
          </h2>
          <p className="text-xl text-slate-600 dark:text-gray-300 max-w-2xl mx-auto">
            Feel free to connect with me on GitHub and LinkedIn to see my work and professional background.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div>
            <div className="space-y-4">
              <a
                href="https://github.com/nguyen-tri-nhan"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 p-4 border border-slate-200 dark:border-gray-700 rounded-lg hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(0,255,136,0.12)] transition-all duration-300 group"
              >
                <Github size={24} className="text-primary" />
                <div>
                  <div className="font-semibold">GitHub</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">@nguyen-tri-nhan</div>
                </div>
              </a>

              <a
                href="https://www.linkedin.com/in/nguyen-tri-nhan/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 p-4 border border-slate-200 dark:border-gray-700 rounded-lg hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(0,255,136,0.12)] transition-all duration-300 group"
              >
                <Linkedin size={24} className="text-blue-500" />
                <div>
                  <div className="font-semibold">LinkedIn</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">/in/nguyen-tri-nhan</div>
                </div>
              </a>

              <a
                href="mailto:nguyentrinhan.dev@gmail.com"
                className="flex items-center space-x-3 p-4 border border-slate-200 dark:border-gray-700 rounded-lg hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(0,255,136,0.12)] transition-all duration-300 group"
              >
                <Mail size={24} className="text-primary" />
                <div>
                  <div className="font-semibold">Email</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">nguyentrinhan.dev@gmail.com</div>
                </div>
              </a>

              <div className="flex items-center space-x-3 p-4 border border-slate-200 dark:border-gray-700 rounded-lg">
                <MapPin size={24} className="text-slate-400 dark:text-gray-500" />
                <div>
                  <div className="font-semibold">Location</div>
                  <div className="text-sm text-slate-500 dark:text-gray-400">Ho Chi Minh City, Vietnam</div>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-slate-500 dark:text-gray-400">
              <p>Open to new opportunities</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
