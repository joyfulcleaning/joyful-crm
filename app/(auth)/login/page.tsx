import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Image from 'next/image'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="flex flex-col items-center">
          <Image
            src="/Joyful_logo_transparent.png"
            alt="Joyful Cleaning Services"
            width={180}
            height={180}
            priority
          />
          <p className="mt-2 text-sm text-gray-500">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}