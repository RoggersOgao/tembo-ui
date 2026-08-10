

import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Calendar } from 'lucide-react'


function Actions() {
  return (
    <div className='flex w-full gap-6 flex-col lg:flex-row'>
      <Card className="glass-card animate-slide-in-right flex-1">
        <CardHeader>
          <CardTitle>Upcoming Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { task: 'Property inspection', time: 'Today, 3:00 PM' },
              { task: 'Lease signing meeting', time: 'Tomorrow, 10:00 AM' },
              { task: 'Maintenance review', time: 'Friday, 2:00 PM' },
            ].map((item, index) => (
              <div key={index} className="p-3 rounded-lg border border-border">
                <p className="text-sm font-medium text-foreground">{item.task}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card animate-slide-in-right">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              'New tenant application received for Downtown Apartment',
              'Payment received from John Smith - $2,850',
              'Maintenance request submitted for Unit 4B',
              'Property viewing scheduled for tomorrow at 2 PM',
              'Lease renewal approved for Sarah Johnson',
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="text-sm text-foreground">{activity}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Actions